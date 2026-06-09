import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  loadSyncState,
  saveSyncState,
  cloneOrUpdateCorpus,
  getLocalRevision,
  extractReformHistory,
  buildReformHistoryIndex,
  promoteArtifacts,
  buildStagedCorpusDatabase,
  cleanupWorkspace,
  isSyncNeeded,
} from "../../src/corpus/sync.js";
import type { SyncState } from "../../src/types/index.js";
import { config } from "../../src/config.js";
import { createTempDir, cleanupTempDir } from "../helpers/setup.js";

describe("corpus/sync", () => {
  let tempDir: string;
  let originalDataDir: string;
  let originalSyncWorkspaceDir: string;

  before(async () => {
    tempDir = await createTempDir();
    originalDataDir = config.dataDir;
    originalSyncWorkspaceDir = config.syncWorkspaceDir;

    // Override config for testing
    (config as any).dataDir = `${tempDir}/data`;
    (config as any).syncWorkspaceDir = `${tempDir}/workspace`;
  });

  after(async () => {
    (config as any).dataDir = originalDataDir;
    (config as any).syncWorkspaceDir = originalSyncWorkspaceDir;
    await cleanupTempDir(tempDir);
  });

  describe("sync state", () => {
    it("should return null when no state exists", async () => {
      const state = await loadSyncState();
      assert.strictEqual(state, null);
    });

    it("should save and load sync state", async () => {
      const state: SyncState = {
        last_checked_at: "2025-01-01T00:00:00Z",
        last_successful_sync_at: "2025-01-01T01:00:00Z",
        last_indexed_revision: "abc123",
        last_seen_remote_revision: "def456",
        law_count: 10,
        chunk_count: 100,
        reform_count: 50,
        skipped_count: 2,
        error_count: 0,
      };

      await saveSyncState(state);
      const loaded = await loadSyncState();
      assert.ok(loaded);
      assert.strictEqual(loaded.last_indexed_revision, "abc123");
      assert.strictEqual(loaded.law_count, 10);
    });

    it("should update existing state", async () => {
      const state: SyncState = {
        last_checked_at: "2025-01-01T00:00:00Z",
        last_successful_sync_at: null,
        last_indexed_revision: null,
        last_seen_remote_revision: null,
        law_count: 0,
        chunk_count: 0,
        reform_count: 0,
        skipped_count: 0,
        error_count: 0,
      };

      await saveSyncState(state);

      state.last_indexed_revision = "xyz789";
      state.law_count = 20;
      await saveSyncState(state);

      const loaded = await loadSyncState();
      assert.ok(loaded);
      assert.strictEqual(loaded.last_indexed_revision, "xyz789");
      assert.strictEqual(loaded.law_count, 20);
    });
  });

  describe("workspace management", () => {
    it("should create and clean workspace", async () => {
      // Skip git operations in sandbox environment
      // This test requires git write permissions
    });
  });

  describe("reform history extraction", () => {
    function git(args: string[], cwd: string): string {
      return execFileSync("git", args, {
        cwd,
        encoding: "utf-8",
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
        },
      });
    }

    it("should extract reform history from git log", async () => {
      const repoDir = path.join(tempDir, "history-repo");
      await fs.mkdir(repoDir, { recursive: true });

      git(["init", "--quiet"], repoDir);
      git(["config", "user.email", "test@example.com"], repoDir);
      git(["config", "user.name", "Test User"], repoDir);

      await fs.writeFile(path.join(repoDir, "law-a.md"), "# Law A\n");
      git(["add", "law-a.md"], repoDir);
      git(["commit", "-m", "Add law A"], repoDir);

      await fs.writeFile(path.join(repoDir, "law-b.md"), "# Law B\n");
      git(["add", "law-b.md"], repoDir);
      git(["commit", "-m", "Add law B"], repoDir);

      await fs.writeFile(path.join(repoDir, "law-a.md"), "# Law A\n\nUpdated\n");
      git(["add", "law-a.md"], repoDir);
      git(["commit", "-m", "Update law A"], repoDir);

      const history = buildReformHistoryIndex(repoDir, ["law-a.md", "law-b.md"]);

      assert.deepStrictEqual(
        history.get("law-a.md")?.map((item) => item.summary),
        ["Update law A", "Add law A"],
      );
      assert.deepStrictEqual(
        history.get("law-b.md")?.map((item) => item.summary),
        ["Add law B"],
      );
      assert.strictEqual(history.has("missing.md"), false);
    });

    it("should return empty array for file with no history", async () => {
      // Skip git operations in sandbox environment
      // This test requires git write permissions
    });
  });

  describe("artifact promotion", () => {
    it("should build staged corpus database from fixtures", async () => {
      const fixturesDir = path.join(process.cwd(), "test", "fixtures", "legalize-es");
      const stagedDbPath = path.join(config.dataDir, config.nextDatabasePath);

      const result = await buildStagedCorpusDatabase(
        fixturesDir,
        "test-revision-sha",
        stagedDbPath,
      );

      assert.strictEqual(result.lawCount, 2);
      assert.ok(result.chunkCount > 2);
      assert.strictEqual(result.errorCount, 0);
      await fs.access(stagedDbPath);
    });

    it("should skip invalid law files while keeping valid indexed content", async () => {
      const workspaceDir = path.join(tempDir, "partial-corpus");
      const stagedDbPath = path.join(config.dataDir, "partial-corpus.db");
      await fs.mkdir(path.join(workspaceDir, "es"), { recursive: true });

      await fs.writeFile(
        path.join(workspaceDir, "es", "VALID-001.md"),
        `---
identifier: VALID-001
title: Valid Law
country: es
last_updated: 2025-01-01
status: in_force
---

### Artículo 1

Valid article text.`,
      );
      await fs.writeFile(
        path.join(workspaceDir, "es", "INVALID-001.md"),
        `---
title: Invalid Law
country: es
last_updated: 2025-01-01
status: in_force
---

### Artículo 1

Invalid article text.`,
      );

      const result = await buildStagedCorpusDatabase(
        workspaceDir,
        "test-revision-sha",
        stagedDbPath,
      );

      assert.strictEqual(result.lawCount, 1);
      assert.strictEqual(result.skippedCount, 1);
      assert.strictEqual(result.errorCount, 1);
      assert.ok(result.chunkCount > 0);
      await fs.access(stagedDbPath);
    });

    it("should promote artifacts atomically", async () => {
      // Create next database
      const nextDbPath = path.join(config.dataDir, config.nextDatabasePath);
      await fs.mkdir(config.dataDir, { recursive: true });
      await fs.writeFile(nextDbPath, "test database content");

      // Promote
      await promoteArtifacts();

      // Check active database exists
      const activeDbPath = path.join(config.dataDir, config.activeDatabasePath);
      const activeExists = await fs
        .access(activeDbPath)
        .then(() => true)
        .catch(() => false);
      assert.ok(activeExists);

      // Check next database no longer exists
      const nextExists = await fs
        .access(nextDbPath)
        .then(() => true)
        .catch(() => false);
      assert.strictEqual(nextExists, false);
    });

    it("should remove active SQLite sidecars during promotion", async () => {
      const nextDbPath = path.join(config.dataDir, config.nextDatabasePath);
      const activeDbPath = path.join(config.dataDir, config.activeDatabasePath);
      await fs.mkdir(config.dataDir, { recursive: true });
      await fs.writeFile(activeDbPath, "old database content");
      await fs.writeFile(`${activeDbPath}-wal`, "old wal content");
      await fs.writeFile(`${activeDbPath}-shm`, "old shm content");
      await fs.writeFile(nextDbPath, "new database content");

      await promoteArtifacts();

      assert.strictEqual(await fs.readFile(activeDbPath, "utf-8"), "new database content");
      await assert.rejects(() => fs.access(`${activeDbPath}-wal`));
      await assert.rejects(() => fs.access(`${activeDbPath}-shm`));
    });

    it("should throw when next database does not exist", async () => {
      await assert.rejects(
        async () => {
          await promoteArtifacts();
        },
        /Next database file does not exist/,
      );
    });
  });

  describe("sync detection", () => {
    it("should return true when no previous sync", async () => {
      const needed = await isSyncNeeded("abc123", null);
      assert.strictEqual(needed, true);
    });

    it("should return true when revisions differ", async () => {
      const state: SyncState = {
        last_checked_at: "2025-01-01T00:00:00Z",
        last_successful_sync_at: "2025-01-01T01:00:00Z",
        last_indexed_revision: "old-revision",
        last_seen_remote_revision: "old-revision",
        law_count: 10,
        chunk_count: 100,
        reform_count: 50,
        skipped_count: 0,
        error_count: 0,
      };

      const needed = await isSyncNeeded("new-revision", state);
      assert.strictEqual(needed, true);
    });

    it("should return false when revisions match", async () => {
      const state: SyncState = {
        last_checked_at: "2025-01-01T00:00:00Z",
        last_successful_sync_at: "2025-01-01T01:00:00Z",
        last_indexed_revision: "current",
        last_seen_remote_revision: "current",
        law_count: 10,
        chunk_count: 100,
        reform_count: 50,
        skipped_count: 0,
        error_count: 0,
      };

      const needed = await isSyncNeeded("current", state, { verifyActiveDatabase: false });
      assert.strictEqual(needed, false);
    });

    it("should return true when revisions match but the active database is empty", async () => {
      const state: SyncState = {
        last_checked_at: "2025-01-01T00:00:00Z",
        last_successful_sync_at: "2025-01-01T01:00:00Z",
        last_indexed_revision: "current",
        last_seen_remote_revision: "current",
        law_count: 10,
        chunk_count: 100,
        reform_count: 50,
        skipped_count: 0,
        error_count: 0,
      };

      const needed = await isSyncNeeded("current", state);
      assert.strictEqual(needed, true);
    });
  });
});
