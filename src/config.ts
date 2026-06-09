/**
 * Application configuration.
 */

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: expected a positive integer`);
  }

  return parsed;
}

export const config = {
  // Corpus source
  corpusRepository: "https://github.com/legalize-dev/legalize-es.git",
  
  // Database paths (relative to data directory)
  activeDatabasePath: "corpus.db",
  nextDatabasePath: "corpus.db.next",
  
  // Sync state path
  syncStatePath: "sync-state.json",
  
  // Data directory (can be overridden by env var)
  dataDir: process.env.DATA_DIR || "./data",
  
  // Ephemeral sync workspace
  syncWorkspaceDir: process.env.SYNC_WORKSPACE_DIR || "./sync-workspace",
  
  // Sync schedule
  syncIntervalMs: readPositiveIntegerEnv("SYNC_INTERVAL_MS", 24 * 60 * 60 * 1000),
  
  // Limits
  maxSearchResults: 20,
  maxReformResults: 50,
  maxArticleChars: 30000,
  maxExcerptChars: 12000,
  defaultSearchLimit: 10,
  defaultReformLimit: 20,
  defaultArticleChars: 12000,
  defaultExcerptChars: 6000,
  
  // Request limits
  maxRequestSizeBytes: 64 * 1024, // 64 KB
  maxResponseSizeBytes: 1024 * 1024, // 1 MB
  globalRateLimitPerMinute: 60,
  searchRateLimitPerMinute: 20,
  excerptRateLimitPerMinute: 20,
  cacheMaxEntries: 256,
  cacheTtlMs: 5 * 60 * 1000,
  sqliteQueryTimeoutMs: 10 * 1000,
  syncNetworkTimeoutMs: readPositiveIntegerEnv("SYNC_NETWORK_TIMEOUT_MS", 120 * 1000),
  syncSubprocessTimeoutMs: readPositiveIntegerEnv(
    "SYNC_SUBPROCESS_TIMEOUT_MS",
    30 * 60 * 1000,
  ),
  
  // Health thresholds
  minFreeSpaceBytes: 512 * 1024 * 1024, // 512 MB
};
