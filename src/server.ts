import rateLimit from "@fastify/rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import Fastify, { type FastifyServerOptions } from "fastify";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { config } from "./config.js";
import { loadSyncState, startDailySyncScheduler } from "./corpus/sync.js";
import { createMcpServer } from "./mcp/server.js";
import { openDatabase, type LawDatabase } from "./store/database.js";

const serviceName = "Spanish Law Research";
const version = process.env.npm_package_version ?? "0.0.0";
const openAiAppsChallengeToken = "qaxcJBxdYVyBldTBcSDEan1QSK0P-FxFCHdmuVzYlZE";
const rateWindowMs = 60 * 1000;
const toolRateBuckets = new Map<string, { count: number; resetAt: number }>();

export interface BuildServerOptions {
  database?: LawDatabase;
  databasePath?: string;
  enableSyncScheduler?: boolean;
  logger?: FastifyServerOptions["logger"];
}

export function buildServer(options: BuildServerOptions = {}) {
  const server = Fastify({
    logger:
      options.logger ??
      {
        level: process.env.LOG_LEVEL ?? "info",
        redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    trustProxy: true,
    bodyLimit: config.maxRequestSizeBytes,
    requestTimeout: 15 * 1000,
    connectionTimeout: 15 * 1000,
  });

  let db: LawDatabase | null = options.database ?? null;
  const ownsDatabase = !options.database;
  const databasePath =
    options.databasePath ?? path.join(config.dataDir, config.activeDatabasePath);
  let syncTimer: NodeJS.Timeout | null = null;

  const reloadDatabase = async () => {
    if (!ownsDatabase) return;

    const nextDb = await openDatabase(databasePath);
    const previousDb = db;
    db = nextDb;
    previousDb?.close();
    server.log.info({ database: "reloaded" }, "Database connection reloaded");
  };

  server.register(rateLimit, {
    max: config.globalRateLimitPerMinute,
    timeWindow: "1 minute",
    skipOnError: true,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      ok: false,
      error: {
        code: "rate_limit_exceeded",
        message: "Rate limit exceeded.",
        details: {
          limit: context.max,
        },
      },
    }),
  });

  server.addHook("onReady", async () => {
    if (db) return;

    db = await openDatabase(databasePath);
    server.log.info({ database: "connected" }, "Database connected");

    if (options.enableSyncScheduler) {
      syncTimer = startDailySyncScheduler(server.log, async (result) => {
        if (result.status === "promoted") {
          await reloadDatabase();
        }
      });
      server.log.info({ scheduler: "daily" }, "Corpus sync scheduler started");
    }
  });

  server.addHook("onClose", async () => {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }

    if (db && ownsDatabase) {
      db.close();
      server.log.info("Database connection closed");
    }
  });

  server.get("/healthz", async () => {
    const storage = await getStorageStatus();
    const index = await getIndexStatus(server.log);
    const database = db ? db.getStats() : null;
    const databaseReady =
      database !== null && database.lawCount > 0 && database.articleCount > 0;

    return {
      ok: db !== null && storage.ok !== false && databaseReady,
      service: serviceName,
      version,
      timestamp: new Date().toISOString(),
      index,
      storage,
      database: database
        ? {
            ...database,
            ready: databaseReady,
          }
        : null,
    };
  });

  server.get("/", async () => ({
    ok: true,
    service: serviceName,
    version,
    disclaimer: "This service provides legal research information, not legal advice.",
  }));

  server.get("/.well-known/openai-apps-challenge", async (_request, reply) =>
    reply.type("text/plain; charset=utf-8").send(openAiAppsChallengeToken),
  );

  server.post(
    "/mcp",
    {
      preHandler: async (request, reply) => {
        const rateLimitResult = consumeMcpToolRateLimit(request.ip, request.body);
        if (!rateLimitResult.ok) {
          return reply.code(429).send({
            jsonrpc: "2.0",
            error: {
              code: -32029,
              message: "Rate limit exceeded.",
              data: {
                scope: rateLimitResult.scope,
                limit: rateLimitResult.limit,
              },
            },
            id: readJsonRpcId(request.body),
          });
        }
      },
    },
    async (request, reply) => {
      if (!db) {
        return reply.code(503).send({
          ok: false,
          error: {
            code: "database_unavailable",
            message: "Database is not available.",
            details: {},
          },
        });
      }

      const mcpServer = createMcpServer(db);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      let closed = false;
      const closeMcp = async () => {
        if (closed) return;
        closed = true;
        await transport.close();
        await mcpServer.close();
      };

      reply.hijack();
      reply.raw.on("close", () => {
        void closeMcp();
      });

      try {
        await mcpServer.connect(transport);
        await transport.handleRequest(request.raw, reply.raw, request.body);
      } catch (error) {
        server.log.error({ error }, "MCP endpoint error");

        if (!reply.raw.headersSent) {
          reply.raw.writeHead(500, { "Content-Type": "application/json" });
          reply.raw.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32603,
                message: "Internal server error",
              },
              id: null,
            }),
          );
        } else if (!reply.raw.writableEnded) {
          reply.raw.end();
        }
      } finally {
        await closeMcp();
      }
    },
  );

  server.get("/mcp", async (_request, reply) =>
    reply.code(405).send({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    }),
  );

  server.delete("/mcp", async (_request, reply) =>
    reply.code(405).send({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    }),
  );

  server.setErrorHandler((error, _request, reply) => {
    server.log.error({ error }, "Request error");

    const statusCode = getStatusCode(error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const message =
      statusCode < 500 || process.env.NODE_ENV === "development"
        ? errorMessage
        : "Internal server error";

    return reply.code(statusCode).send({
      ok: false,
      error: message,
    });
  });

  server.setNotFoundHandler(async (_request, reply) =>
    reply.code(404).send({
      ok: false,
      error: "Not found",
    }),
  );

  return server;
}

function getStatusCode(error: unknown): number {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400
  ) {
    return error.statusCode;
  }

  return 500;
}

async function getIndexStatus(logger: { error: (details: object, message: string) => void }) {
  try {
    const syncState = await loadSyncState();
    if (!syncState) {
      return {
        synced: false,
        last_successful_sync_at: null,
        last_indexed_revision: null,
        last_seen_remote_revision: null,
        stale: true,
        divergent: false,
      };
    }

    const lastSuccessfulSyncAt = syncState.last_successful_sync_at
      ? Date.parse(syncState.last_successful_sync_at)
      : 0;
    const stale =
      !lastSuccessfulSyncAt ||
      Date.now() - lastSuccessfulSyncAt > 48 * 60 * 60 * 1000;

    return {
      synced: Boolean(syncState.last_indexed_revision),
      last_successful_sync_at: syncState.last_successful_sync_at,
      last_indexed_revision: syncState.last_indexed_revision,
      last_seen_remote_revision: syncState.last_seen_remote_revision,
      stale,
      divergent: Boolean(
        syncState.last_seen_remote_revision &&
          syncState.last_indexed_revision &&
          syncState.last_seen_remote_revision !== syncState.last_indexed_revision,
      ),
      law_count: syncState.law_count,
      chunk_count: syncState.chunk_count,
      reform_count: syncState.reform_count,
      skipped_count: syncState.skipped_count,
      error_count: syncState.error_count,
    };
  } catch (error) {
    logger.error({ error }, "Failed to load sync state for health check");
    return {
      synced: false,
      last_successful_sync_at: null,
      last_indexed_revision: null,
      last_seen_remote_revision: null,
      stale: true,
      divergent: false,
      error: "sync_state_unavailable",
    };
  }
}

async function getStorageStatus(): Promise<{
  ok: boolean | null;
  free_bytes: number | null;
  min_free_bytes: number;
}> {
  try {
    const stats = await fs.statfs(config.dataDir);
    const freeBytes = stats.bavail * stats.bsize;

    return {
      ok: freeBytes >= config.minFreeSpaceBytes,
      free_bytes: freeBytes,
      min_free_bytes: config.minFreeSpaceBytes,
    };
  } catch {
    return {
      ok: null,
      free_bytes: null,
      min_free_bytes: config.minFreeSpaceBytes,
    };
  }
}

function consumeMcpToolRateLimit(
  ip: string,
  body: unknown,
):
  | { ok: true }
  | {
      ok: false;
      scope: string;
      limit: number;
    } {
  for (const toolName of extractToolNames(body)) {
    const toolLimit = getToolLimit(toolName);
    if (!toolLimit) {
      continue;
    }

    const bucketKey = `${ip}:${toolLimit.scope}`;
    if (!consumeBucket(bucketKey, toolLimit.limit)) {
      return {
        ok: false,
        scope: toolLimit.scope,
        limit: toolLimit.limit,
      };
    }
  }

  return { ok: true };
}

function extractToolNames(body: unknown): string[] {
  const messages = Array.isArray(body) ? body : [body];
  const toolNames: string[] = [];

  for (const message of messages) {
    if (!message || typeof message !== "object") {
      continue;
    }

    if (!("method" in message) || message.method !== "tools/call") {
      continue;
    }

    if (!("params" in message) || !message.params || typeof message.params !== "object") {
      continue;
    }

    if ("name" in message.params && typeof message.params.name === "string") {
      toolNames.push(message.params.name);
    }
  }

  return toolNames;
}

function getToolLimit(toolName: string): { scope: string; limit: number } | null {
  if (toolName === "search_laws") {
    return { scope: "search_laws", limit: config.searchRateLimitPerMinute };
  }

  if (toolName === "get_law_excerpt") {
    return { scope: "get_law_excerpt", limit: config.excerptRateLimitPerMinute };
  }

  return null;
}

function consumeBucket(key: string, limit: number): boolean {
  const now = Date.now();
  const existing = toolRateBuckets.get(key);

  if (!existing || now >= existing.resetAt) {
    toolRateBuckets.set(key, {
      count: 1,
      resetAt: now + rateWindowMs,
    });
    cleanupRateBuckets(now);
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  return true;
}

function cleanupRateBuckets(now: number): void {
  if (toolRateBuckets.size < 10_000) {
    return;
  }

  for (const [key, bucket] of toolRateBuckets) {
    if (now >= bucket.resetAt) {
      toolRateBuckets.delete(key);
    }
  }
}

function readJsonRpcId(body: unknown): string | number | null {
  if (!body || Array.isArray(body) || typeof body !== "object" || !("id" in body)) {
    return null;
  }

  if (typeof body.id === "string" || typeof body.id === "number" || body.id === null) {
    return body.id;
  }

  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? "3000");
  const host = process.env.HOST ?? "0.0.0.0";
  const server = buildServer({ enableSyncScheduler: true });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
      server.log.info({ signal }, "Shutting down");
      await server.close();
      process.exit(0);
    });
  }

  try {
    await server.listen({ port, host });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}
