import * as fs from "node:fs/promises";
import * as path from "node:path";
import { LawDatabase, openDatabase } from "../../src/store/database.js";
import { parseLawFile } from "../../src/corpus/parser.js";
import type { LawRecord, ArticleChunk, ReformRecord } from "../../src/types/index.js";

/**
 * Create a temporary directory for test databases.
 */
export async function createTempDir(): Promise<string> {
  const rootDir = path.join(process.cwd(), "test-temp");
  await fs.mkdir(rootDir, { recursive: true });
  return fs.mkdtemp(path.join(rootDir, "test-"));
}

/**
 * Clean up a temporary directory.
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Test helper: ignore cleanup failures to avoid test flakiness
  }
}

/**
 * Read a fixture file.
 */
export async function readFixture(
  fixturePath: string,
): Promise<string> {
  const fullPath = path.join(process.cwd(), "test", "fixtures", fixturePath);
  return await fs.readFile(fullPath, "utf-8");
}

/**
 * Build a test database from legalize-es fixtures.
 */
export async function buildTestDatabase(tempDir: string): Promise<LawDatabase> {
  const dbPath = path.join(tempDir, "test-corpus.db");
  const db = await openDatabase(dbPath);

  // Load and index fixture laws
  const fixturesDir = path.join(process.cwd(), "test", "fixtures", "legalize-es");
  
  // Recursively find all .md files in fixtures
  async function findLawFiles(dir: string, basePath: string = ""): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await findLawFiles(fullPath, relativePath);
        files.push(...subFiles);
      } else if (entry.name.endsWith(".md")) {
        files.push(relativePath);
      }
    }
    
    return files;
  }

  const lawFiles = await findLawFiles(fixturesDir);

  for (const lawFile of lawFiles) {
    const fullPath = path.join(fixturesDir, lawFile);
    const content = await fs.readFile(fullPath, "utf-8");
    
    try {
      const parsed = parseLawFile(content, lawFile, "test-revision-sha");
      
      // Insert law record
      db.upsertLaw(parsed.law);
      
      // Insert article chunks
      db.insertArticleChunks(parsed.chunks);
      
      // Insert reform records (empty for fixtures)
      db.insertReforms(parsed.reforms || []);
    } catch (error) {
      // Skip files that fail to parse
      console.warn(`Failed to parse fixture ${lawFile}:`, error);
    }
  }

  return db;
}

/**
 * Create a minimal test database with one national law.
 */
export async function buildMinimalTestDatabase(tempDir: string): Promise<LawDatabase> {
  const dbPath = path.join(tempDir, "test-minimal.db");
  const db = await openDatabase(dbPath);

  // Load the Spanish Civil Code fixture
  const civilCodeContent = await readFixture("legalize-es/es/BOE-A-1889-4763.md");
  const parsed = parseLawFile(civilCodeContent, "es/BOE-A-1889-4763.md", "test-revision-sha");

  db.upsertLaw(parsed.law);
  db.insertArticleChunks(parsed.chunks);
  db.insertReforms([]);

  return db;
}
