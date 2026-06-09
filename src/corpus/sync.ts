import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import type { ReformRecord, SyncState } from "../types/index.js";
import { config } from "../config.js";
import { parseLawFile } from "./parser.js";
import { createStagingDatabase, openDatabase, type LawDatabase } from "../store/database.js";

const GIT_LOG_MAX_BUFFER_BYTES = 128 * 1024 * 1024;

export interface CorpusBuildResult {
  lawCount: number;
  chunkCount: number;
  reformCount: number;
  skippedCount: number;
  errorCount: number;
}

export interface CorpusSyncResult extends CorpusBuildResult {
  status: "skipped" | "promoted";
  remoteRevision: string;
  indexedRevision: string | null;
}

interface ReformHistoryItem {
  commitSha: string;
  date: string;
  summary: string;
}

interface SyncLogger {
  info?: (details: Record<string, unknown>, message: string) => void;
  error?: (details: Record<string, unknown>, message: string) => void;
}

/**
 * Get the remote HEAD revision using git ls-remote.
 * Does not clone the repository.
 */
export async function getRemoteRevision(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["ls-remote", config.corpusRepository, "HEAD"],
      {
        encoding: "utf-8",
        env: gitEnv(),
        timeout: config.syncNetworkTimeoutMs,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `Failed to get remote revision: ${error.message}`,
            ),
          );
          return;
        }
        const [revision] = stdout.trim().split(/\s+/);
        if (!revision) {
          reject(new Error("Failed to parse remote revision from git ls-remote output"));
          return;
        }
        resolve(revision);
      },
    );
  });
}

/**
 * Load sync state from disk.
 */
export async function loadSyncState(): Promise<SyncState | null> {
  const statePath = path.join(config.dataDir, config.syncStatePath);

  try {
    const content = await fs.readFile(statePath, "utf-8");
    return JSON.parse(content) as SyncState;
  } catch (error) {
    const errnoError = error as NodeJS.ErrnoException;
    if (errnoError.code === "ENOENT") {
      return null;
    }
    throw new Error(
      `Failed to load sync state: ${errnoError.message}`,
    );
  }
}

/**
 * Save sync state to disk.
 */
export async function saveSyncState(state: SyncState): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true });
  const statePath = path.join(config.dataDir, config.syncStatePath);
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}

/**
 * Clone or fetch the corpus repository to the ephemeral workspace.
 */
export async function cloneOrUpdateCorpus(
  targetRevision?: string,
): Promise<string> {
  const workspaceDir = config.syncWorkspaceDir;

  // Clean workspace if it exists
  try {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  } catch (error) {
    const errnoError = error as NodeJS.ErrnoException;
    if (errnoError.code !== "ENOENT") {
      throw new Error(
        `Failed to clean workspace: ${errnoError.message}`,
      );
    }
  }

  await fs.mkdir(workspaceDir, { recursive: true });

  return new Promise((resolve, reject) => {
    // Clone the repository (always clone default branch first)
    execFile(
      "git",
      ["clone", config.corpusRepository, workspaceDir],
      {
        encoding: "utf-8",
        env: gitEnv(),
        timeout: config.syncSubprocessTimeoutMs,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `Failed to clone corpus: ${error.message}`,
            ),
          );
          return;
        }

        // If target revision is provided, checkout that specific revision
        if (targetRevision) {
          execFile(
            "git",
            ["checkout", targetRevision],
            {
              encoding: "utf-8",
              cwd: workspaceDir,
              env: gitEnv(),
              timeout: config.syncSubprocessTimeoutMs,
            },
            (checkoutError, checkoutStdout, checkoutStderr) => {
              if (checkoutError) {
                reject(
                  new Error(
                    `Failed to checkout revision ${targetRevision}: ${checkoutError.message}`,
                  ),
                );
                return;
              }

              // Get current revision
              try {
	                const revision = execFileSync("git", ["rev-parse", "HEAD"], {
	                  encoding: "utf-8",
	                  cwd: workspaceDir,
	                  env: gitEnv(),
	                  timeout: config.syncSubprocessTimeoutMs,
	                });
                resolve(revision.trim());
              } catch (revError) {
                reject(
                  new Error(
                    `Failed to get current revision: ${revError instanceof Error ? revError.message : String(revError)}`,
                  ),
                );
              }
            },
          );
        } else {
          // Get current revision
          try {
	            const revision = execFileSync("git", ["rev-parse", "HEAD"], {
	              encoding: "utf-8",
	              cwd: workspaceDir,
	              env: gitEnv(),
	              timeout: config.syncSubprocessTimeoutMs,
	            });
            resolve(revision.trim());
          } catch (revError) {
            reject(
              new Error(
                `Failed to get current revision: ${revError instanceof Error ? revError.message : String(revError)}`,
              ),
            );
          }
        }
      },
    );
  });
}

/**
 * Get the current revision of a local git repository.
 */
export function getLocalRevision(repoPath: string): string {
  try {
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf-8",
      cwd: repoPath,
      env: gitEnv(),
      timeout: config.syncSubprocessTimeoutMs,
    });
    return revision.trim();
  } catch (error) {
    throw new Error(
      `Failed to get local revision: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Extract reform history from Git log for a specific law file.
 */
export function extractReformHistory(
  repoPath: string,
  lawFilePath: string,
): ReformHistoryItem[] {
  return buildReformHistoryIndex(repoPath, [lawFilePath]).get(lawFilePath) ?? [];
}

/**
 * Extract reform history for current Markdown files with one git log scan.
 */
export function buildReformHistoryIndex(
  repoPath: string,
  lawFilePaths: string[],
): Map<string, ReformHistoryItem[]> {
  const allowedPaths = new Set(lawFilePaths);
  const historyByPath = new Map<string, ReformHistoryItem[]>();

  if (lawFilePaths.length === 0) {
    return historyByPath;
  }

  try {
    const log = execFileSync(
      "git",
      [
        "log",
        "--date=short",
        "--pretty=format:%x1e%H%x1f%ai%x1f%s",
        "--name-only",
        "--diff-filter=ACMRT",
        "--",
        "*.md",
      ],
      {
        encoding: "utf-8",
        cwd: repoPath,
        env: gitEnv(),
        timeout: config.syncSubprocessTimeoutMs,
        maxBuffer: GIT_LOG_MAX_BUFFER_BYTES,
      },
    );

    for (const record of log.split("\x1e")) {
      const lines = record.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) {
        continue;
      }

      const [commitSha, date, ...summaryParts] = lines[0].split("\x1f");
      if (!commitSha || !date) {
        throw new Error("Failed to parse git log output");
      }

      const reform: ReformHistoryItem = {
        commitSha,
        date: date.split(" ")[0],
        summary: summaryParts.join("\x1f"),
      };

      const changedPaths = new Set(lines.slice(1));
      for (const changedPath of changedPaths) {
        if (!allowedPaths.has(changedPath)) {
          continue;
        }

        const currentHistory = historyByPath.get(changedPath);
        if (currentHistory) {
          currentHistory.push(reform);
        } else {
          historyByPath.set(changedPath, [reform]);
        }
      }
    }

    return historyByPath;
  } catch (error) {
    // If the workspace is not a git repository, reform history is unavailable.
    const errnoError = error as NodeJS.ErrnoException;
    if (
      errnoError.code === "ENOENT" ||
      errnoError.message?.includes("bad revision") ||
      errnoError.message?.includes("not a git repository")
    ) {
      return historyByPath;
    }
    throw new Error(
      `Failed to extract reform history: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Promote staged artifacts atomically.
 * Moves *.next files to active paths.
 */
export async function promoteArtifacts(): Promise<void> {
  const activeDbPath = path.join(config.dataDir, config.activeDatabasePath);
  const nextDbPath = path.join(config.dataDir, config.nextDatabasePath);

  try {
    // Check if next file exists
    await fs.access(nextDbPath);

    await removeStagedDatabase(activeDbPath);

    // Atomic rename
    await fs.rename(nextDbPath, activeDbPath);
  } catch (error) {
    const errnoError = error as NodeJS.ErrnoException;
    if (errnoError.code === "ENOENT") {
      throw new Error(
        "Next database file does not exist, cannot promote",
      );
    }
    throw new Error(
      `Failed to promote artifacts: ${errnoError.message}`,
    );
  }
}

/**
 * Build a staged corpus database from a checked-out legalize-es workspace.
 */
export async function buildStagedCorpusDatabase(
  workspaceDir: string,
  sourceRevision: string,
  stagedDbPath: string,
  logger?: SyncLogger,
): Promise<CorpusBuildResult> {
  const lawFiles = await findMarkdownFiles(workspaceDir);
  logger?.info?.({ lawFileCount: lawFiles.length }, "Corpus markdown files discovered");

  logger?.info?.({ lawFileCount: lawFiles.length }, "Corpus reform history index started");
  const reformHistoryIndex = buildReformHistoryIndex(workspaceDir, lawFiles);
  logger?.info?.(
    { trackedFileCount: reformHistoryIndex.size },
    "Corpus reform history indexed",
  );

  const db = await createStagingDatabase(stagedDbPath);
  const errors: string[] = [];
  let lawCount = 0;
  let chunkCount = 0;
  let reformCount = 0;
  let processedCount = 0;

  try {
    for (const lawFile of lawFiles) {
      processedCount += 1;
      const fullPath = path.join(workspaceDir, lawFile);
      const content = await fs.readFile(fullPath, "utf-8");

      try {
        const parsed = parseLawFile(content, lawFile, sourceRevision);
        const reformHistory = reformHistoryIndex.get(lawFile) ?? [];
        const reforms = reformHistory.map((item): ReformRecord => ({
          law_identifier: parsed.law.identifier,
          commit_sha: item.commitSha,
          date: item.date,
          source_id: null,
          disposition_id: null,
          affected_articles: null,
          summary: item.summary,
          github_commit_url: `https://github.com/legalize-dev/legalize-es/commit/${item.commitSha}`,
          source_url: parsed.law.boe_url,
        }));

        db.upsertLaw(parsed.law);
        db.insertArticleChunks(parsed.chunks);
        db.insertReforms(reforms);

        lawCount += 1;
        chunkCount += parsed.chunks.length;
        reformCount += reforms.length;

        if (processedCount % 500 === 0) {
          logger?.info?.(
            {
              processedCount,
              totalCount: lawFiles.length,
              lawCount,
              chunkCount,
              reformCount,
              errorCount: errors.length,
            },
            "Corpus database build progress",
          );
        }
      } catch (error) {
        errors.push(`${lawFile}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    db.getDb().pragma("wal_checkpoint(TRUNCATE)");
    db.close();
  }

  if (lawCount === 0 || chunkCount === 0) {
    await removeStagedDatabase(stagedDbPath);
    throw new Error("Corpus build produced no indexed laws or article chunks");
  }

  if (errors.length > 0) {
    logger?.info?.(
      {
        skippedCount: errors.length,
        sampleErrors: errors.slice(0, 5),
      },
      "Corpus documents skipped during build",
    );
  }

  return {
    lawCount,
    chunkCount,
    reformCount,
    skippedCount: errors.length,
    errorCount: errors.length,
  };
}

/**
 * Run one complete corpus sync cycle.
 */
export async function runCorpusSyncOnce(
  remoteRevision?: string,
  logger: SyncLogger = console,
): Promise<CorpusSyncResult> {
  const checkedAt = new Date().toISOString();
  logger.info?.({}, "Corpus sync started");

  const actualRemoteRevision = remoteRevision ?? await getRemoteRevision();
  logger.info?.({ remoteRevision: actualRemoteRevision }, "Corpus remote revision resolved");

  const previousState = await loadSyncState();

  if (!await isSyncNeeded(actualRemoteRevision, previousState)) {
    const retainedState = previousState ?? emptySyncState(checkedAt);
    await saveSyncState({
      ...retainedState,
      last_checked_at: checkedAt,
      last_seen_remote_revision: actualRemoteRevision,
    });

    return {
      status: "skipped",
      remoteRevision: actualRemoteRevision,
      indexedRevision: retainedState.last_indexed_revision,
      lawCount: retainedState.law_count,
      chunkCount: retainedState.chunk_count,
      reformCount: retainedState.reform_count,
      skippedCount: retainedState.skipped_count,
      errorCount: retainedState.error_count,
    };
  }

  const ephemeralDbPath = path.join(config.syncWorkspaceDir, config.nextDatabasePath);
  const nextDbPath = path.join(config.dataDir, config.nextDatabasePath);
  let sourceRevision: string | null = null;

  try {
    logger.info?.({}, "Corpus clone started");
    sourceRevision = await cloneOrUpdateCorpus(actualRemoteRevision);
    logger.info?.({ sourceRevision }, "Corpus clone completed");

    logger.info?.({}, "Corpus database build started");
    const buildResult = await buildStagedCorpusDatabase(
      config.syncWorkspaceDir,
      sourceRevision,
      ephemeralDbPath,
      logger,
    );
    logger.info?.({ buildResult }, "Corpus database build completed");

    logger.info?.({}, "Corpus artifact promotion started");
    await copyValidatedArtifact(ephemeralDbPath, nextDbPath);
    await promoteArtifacts();
    logger.info?.({}, "Corpus artifact promotion completed");

    await saveSyncState({
      last_checked_at: checkedAt,
      last_successful_sync_at: checkedAt,
      last_indexed_revision: sourceRevision,
      last_seen_remote_revision: actualRemoteRevision,
      law_count: buildResult.lawCount,
      chunk_count: buildResult.chunkCount,
      reform_count: buildResult.reformCount,
      skipped_count: buildResult.skippedCount,
      error_count: buildResult.errorCount,
    });

    return {
      status: "promoted",
      remoteRevision: actualRemoteRevision,
      indexedRevision: sourceRevision,
      ...buildResult,
    };
  } catch (error) {
    const retainedState = previousState ?? emptySyncState(checkedAt);
    await saveSyncState({
      ...retainedState,
      last_checked_at: checkedAt,
      last_seen_remote_revision: actualRemoteRevision,
      error_count: retainedState.error_count + 1,
    });
    throw error;
  } finally {
    await cleanupWorkspace();
  }
}

async function copyValidatedArtifact(sourcePath: string, targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await removeStagedDatabase(targetPath);
  await fs.copyFile(sourcePath, targetPath);
}

/**
 * Start the daily in-process corpus sync scheduler.
 */
type SyncCompleteHandler = (result: CorpusSyncResult) => Promise<void> | void;

export function startDailySyncScheduler(
  logger: SyncLogger = console,
  onSyncComplete?: SyncCompleteHandler,
): NodeJS.Timeout {
  const run = () => {
    void runCorpusSyncOnce(undefined, logger)
      .then(async (result) => {
        logger.info?.({ result }, "Corpus sync completed");
        await onSyncComplete?.(result);
      })
      .catch((error) => {
        logger.error?.({ error: serializeError(error) }, "Corpus sync failed");
      });
  };

  run();

  const timer = setInterval(run, config.syncIntervalMs);

  timer.unref();
  return timer;
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
  };
}

/**
 * Clean up ephemeral workspace.
 */
export async function cleanupWorkspace(): Promise<void> {
  try {
    await fs.rm(config.syncWorkspaceDir, { recursive: true, force: true });
  } catch (error) {
    const errnoError = error as NodeJS.ErrnoException;
    if (errnoError.code !== "ENOENT") {
      throw new Error(
        `Failed to cleanup workspace: ${errnoError.message}`,
      );
    }
  }
}

/**
 * Check if a sync is needed based on remote vs local revision.
 * @param remoteRevision - Optional remote revision for testing (defaults to fetching from git)
 * @param syncState - Optional sync state for testing (defaults to loading from disk)
 */
export async function isSyncNeeded(
  remoteRevision?: string,
  syncState?: SyncState | null,
  options: { verifyActiveDatabase?: boolean } = {},
): Promise<boolean> {
  const actualRemoteRevision = remoteRevision || await getRemoteRevision();
  const actualSyncState = syncState !== undefined ? syncState : await loadSyncState();
  const verifyActiveDatabase = options.verifyActiveDatabase ?? true;

  if (!actualSyncState || !actualSyncState.last_indexed_revision) {
    return true; // No previous sync
  }

  if (actualRemoteRevision !== actualSyncState.last_indexed_revision) {
    return true;
  }

  if (!verifyActiveDatabase) {
    return false;
  }

  return !await hasActiveDatabaseContent();
}

async function findMarkdownFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git") {
          continue;
        }
        await walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(path.relative(rootDir, fullPath).split(path.sep).join("/"));
      }
    }
  }

  await walk(rootDir);
  return files.sort();
}

async function removeStagedDatabase(stagedDbPath: string): Promise<void> {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      await fs.rm(`${stagedDbPath}${suffix}`, { force: true });
    } catch (error) {
      const errnoError = error as NodeJS.ErrnoException;
      if (errnoError.code !== "ENOENT") {
        throw new Error(`Failed to remove staged database: ${errnoError.message}`);
      }
    }
  }
}

async function hasActiveDatabaseContent(): Promise<boolean> {
  let db: LawDatabase | null = null;
  try {
    db = await openDatabase(path.join(config.dataDir, config.activeDatabasePath));
    const stats = db.getStats();
    return stats.lawCount > 0 && stats.articleCount > 0;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

function emptySyncState(checkedAt: string): SyncState {
  return {
    last_checked_at: checkedAt,
    last_successful_sync_at: null,
    last_indexed_revision: null,
    last_seen_remote_revision: null,
    law_count: 0,
    chunk_count: 0,
    reform_count: 0,
    skipped_count: 0,
    error_count: 0,
  };
}
