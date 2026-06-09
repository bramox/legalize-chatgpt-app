import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { buildServer } from "../../src/server.js";
import { config } from "../../src/config.js";
import { cleanupTempDir, buildMinimalTestDatabase, createTempDir } from "../helpers/setup.js";

describe("HTTP Server", () => {
  let tempDir: string;
  let db: Awaited<ReturnType<typeof buildMinimalTestDatabase>>;
  let server: ReturnType<typeof buildServer>;
  let baseUrl: string;

  before(async () => {
    tempDir = await createTempDir();
    db = await buildMinimalTestDatabase(tempDir);
    server = buildServer({ database: db, logger: false });

    await server.listen({ port: 0, host: "127.0.0.1" });

    const address = server.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Server address not available");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await server.close();
    db.close();
    await cleanupTempDir(tempDir);
  });

  describe("Health Check", () => {
    it("returns healthy status without private paths", async () => {
      const response = await fetch(`${baseUrl}/healthz`);
      assert.strictEqual(response.status, 200);

      const data = (await response.json()) as Record<string, unknown>;
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.service, "Spanish Law Research");
      assert.ok(data.version);
      assert.ok(data.timestamp);
      assert.strictEqual(data.dbPath, undefined);
      assert.strictEqual(data.dataDir, undefined);
    });
  });

  describe("Root Endpoint", () => {
    it("returns service info", async () => {
      const response = await fetch(`${baseUrl}/`);
      assert.strictEqual(response.status, 200);

      const data = (await response.json()) as Record<string, unknown>;
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.service, "Spanish Law Research");
      assert.ok(data.disclaimer);
    });
  });

  describe("MCP Endpoint", () => {
    it("supports Streamable HTTP listTools and callTool", async () => {
      const client = new Client({
        name: "http-test-client",
        version: "0.0.0",
      });
      const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));

      try {
        await client.connect(transport);

        const tools = await client.listTools();
        assert.ok(tools.tools.some((tool) => tool.name === "search_laws"));

        const result = await client.callTool({
          name: "search_laws",
          arguments: {
            query: "civil",
            limit: 5,
          },
        });

        const structuredContent = result.structuredContent as Record<string, unknown>;
        assert.ok(structuredContent);
        assert.strictEqual(structuredContent.ok, true);
        assert.ok(Array.isArray(structuredContent.results));
      } finally {
        await client.close();
      }
    });

    it("rejects unsupported MCP methods explicitly", async () => {
      const response = await fetch(`${baseUrl}/mcp`);
      assert.strictEqual(response.status, 405);

      const data = (await response.json()) as Record<string, unknown>;
      assert.strictEqual(data.jsonrpc, "2.0");
      assert.ok(data.error);
    });

    it("enforces the excerpt tool per-IP rate limit", async () => {
      for (let index = 0; index < config.excerptRateLimitPerMinute; index += 1) {
        const response = await callExcerptWithoutInitialization(index + 1);
        assert.notStrictEqual(response.status, 429);
      }

      const limited = await callExcerptWithoutInitialization(99);
      assert.strictEqual(limited.status, 429);

      const data = (await limited.json()) as {
        error?: {
          data?: {
            scope?: string;
            limit?: number;
          };
        };
      };
      assert.strictEqual(data.error?.data?.scope, "get_law_excerpt");
      assert.strictEqual(data.error?.data?.limit, config.excerptRateLimitPerMinute);
    });
  });

  describe("Error Handling", () => {
    it("returns 404 for unknown routes", async () => {
      const response = await fetch(`${baseUrl}/unknown`);
      assert.strictEqual(response.status, 404);

      const data = (await response.json()) as Record<string, unknown>;
      assert.strictEqual(data.ok, false);
      assert.strictEqual(data.error, "Not found");
    });

    it("does not leak stack traces in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      try {
        const response = await fetch(`${baseUrl}/unknown`);
        const data = (await response.json()) as Record<string, unknown>;

        assert.strictEqual(data.stack, undefined);
        assert.strictEqual(data.message, undefined);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe("Body Limit", () => {
    it("enforces the 64 KB body limit", async () => {
      const largeBody = "a".repeat(65 * 1024);
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: largeBody,
      });

      assert.ok(response.status === 413 || response.status === 400);
    });
  });

  async function callExcerptWithoutInitialization(id: number): Promise<Response> {
    return await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: {
          name: "get_law_excerpt",
          arguments: {
            identifier: "BOE-A-1889-4763",
            query: "fuentes",
          },
        },
      }),
    });
  }
});
