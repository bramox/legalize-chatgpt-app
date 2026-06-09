import Database from "better-sqlite3";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  LawRecord,
  ArticleChunk,
  ReformRecord,
  Citation,
  SearchResult,
  Article,
  Excerpt,
  ReformListItem,
} from "../types/index.js";
import { config } from "../config.js";

/**
 * SQLite database store with FTS5 for full-text search.
 * Uses external-content FTS5 design to avoid duplicating article text.
 */
export class LawDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initSchema();
  }

  /**
   * Initialize database schema.
   */
  private initSchema(): void {
    // Laws table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS laws (
        identifier TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        status TEXT NOT NULL,
        rank TEXT,
        publication_date TEXT,
        last_updated TEXT NOT NULL,
        source_revision TEXT NOT NULL,
        legalize_path TEXT NOT NULL,
        github_url TEXT NOT NULL,
        raw_url TEXT NOT NULL,
        boe_url TEXT,
        eli_url TEXT,
        url_html_consolidada TEXT,
        url_pdf TEXT,
        department TEXT,
        subjects TEXT,
        consolidation_status TEXT,
        scope TEXT,
        frontmatter TEXT
      )
    `);

    // Article chunks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        law_identifier TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        article_number TEXT NOT NULL,
        heading_path TEXT NOT NULL,
        text TEXT NOT NULL,
        source_revision TEXT NOT NULL,
        legalize_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        FOREIGN KEY (law_identifier) REFERENCES laws(identifier)
      )
    `);

    // Reforms table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        law_identifier TEXT NOT NULL,
        commit_sha TEXT NOT NULL,
        date TEXT NOT NULL,
        source_id TEXT,
        disposition_id TEXT,
        affected_articles TEXT,
        summary TEXT NOT NULL,
        github_commit_url TEXT NOT NULL,
        source_url TEXT,
        FOREIGN KEY (law_identifier) REFERENCES laws(identifier)
      )
    `);

    // FTS5 external-content table for search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
        law_identifier,
        jurisdiction,
        article_number,
        heading_path,
        text,
        content='articles',
        content_rowid='id'
      )
    `);

    // Triggers to keep FTS in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
        INSERT INTO articles_fts(rowid, law_identifier, jurisdiction, article_number, heading_path, text)
        VALUES (new.id, new.law_identifier, new.jurisdiction, new.article_number, new.heading_path, new.text);
      END;

      CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
        DELETE FROM articles_fts WHERE rowid = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
        DELETE FROM articles_fts WHERE rowid = old.id;
        INSERT INTO articles_fts(rowid, law_identifier, jurisdiction, article_number, heading_path, text)
        VALUES (new.id, new.law_identifier, new.jurisdiction, new.article_number, new.heading_path, new.text);
      END;
    `);

    // Create indexes for common queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_laws_jurisdiction ON laws(jurisdiction);
      CREATE INDEX IF NOT EXISTS idx_laws_status ON laws(status);
      CREATE INDEX IF NOT EXISTS idx_articles_law_identifier ON articles(law_identifier);
      CREATE INDEX IF NOT EXISTS idx_articles_article_number ON articles(article_number);
      CREATE INDEX IF NOT EXISTS idx_reforms_law_identifier ON reforms(law_identifier);
      CREATE INDEX IF NOT EXISTS idx_reforms_date ON reforms(date);
    `);
  }

  /**
   * Insert or update a law record.
   */
  upsertLaw(record: LawRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO laws (
        identifier, title, jurisdiction, status, rank, publication_date, last_updated,
        source_revision, legalize_path, github_url, raw_url, boe_url, eli_url,
        url_html_consolidada, url_pdf, department, subjects, consolidation_status,
        scope, frontmatter
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(identifier) DO UPDATE SET
        title = excluded.title,
        jurisdiction = excluded.jurisdiction,
        status = excluded.status,
        rank = excluded.rank,
        publication_date = excluded.publication_date,
        last_updated = excluded.last_updated,
        source_revision = excluded.source_revision,
        legalize_path = excluded.legalize_path,
        github_url = excluded.github_url,
        raw_url = excluded.raw_url,
        boe_url = excluded.boe_url,
        eli_url = excluded.eli_url,
        url_html_consolidada = excluded.url_html_consolidada,
        url_pdf = excluded.url_pdf,
        department = excluded.department,
        subjects = excluded.subjects,
        consolidation_status = excluded.consolidation_status,
        scope = excluded.scope,
        frontmatter = excluded.frontmatter
    `);

    stmt.run(
      record.identifier,
      record.title,
      record.jurisdiction,
      record.status,
      record.rank,
      record.publication_date,
      record.last_updated,
      record.source_revision,
      record.legalize_path,
      record.github_url,
      record.raw_url,
      record.boe_url,
      record.eli_url,
      record.url_html_consolidada,
      record.url_pdf,
      record.department,
      record.subjects ? JSON.stringify(record.subjects) : null,
      record.consolidation_status,
      record.scope,
      JSON.stringify(record.frontmatter),
    );
  }

  /**
   * Insert article chunks.
   */
  insertArticleChunks(chunks: ArticleChunk[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO articles (law_identifier, jurisdiction, article_number, heading_path, text, source_revision, legalize_path, chunk_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((chunks: ArticleChunk[]) => {
      for (const chunk of chunks) {
        stmt.run(
          chunk.law_identifier,
          chunk.jurisdiction,
          chunk.article_number,
          JSON.stringify(chunk.heading_path),
          chunk.text,
          chunk.source_revision,
          chunk.legalize_path,
          chunk.chunk_index,
        );
      }
    });

    insertMany(chunks);
  }

  /**
   * Insert reform records.
   */
  insertReforms(reforms: ReformRecord[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO reforms (law_identifier, commit_sha, date, source_id, disposition_id, affected_articles, summary, github_commit_url, source_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((reforms: ReformRecord[]) => {
      for (const reform of reforms) {
        stmt.run(
          reform.law_identifier,
          reform.commit_sha,
          reform.date,
          reform.source_id,
          reform.disposition_id,
          reform.affected_articles ? JSON.stringify(reform.affected_articles) : null,
          reform.summary,
          reform.github_commit_url,
          reform.source_url,
        );
      }
    });

    insertMany(reforms);
  }

  /**
   * Search laws by query with optional filters.
   * Uses FTS5 for article/body matching with title fallback.
   */
  searchLaws(
    query: string,
    jurisdiction?: string,
    status?: string,
    rank?: string,
    dateFrom?: string,
    dateTo?: string,
    limit: number = config.defaultSearchLimit,
  ): SearchResult[] {
    const ftsQuery = buildFtsQuery(query);
    let ftsSql = `
      SELECT DISTINCT
        laws.*,
        snippet(articles_fts, 4, '<mark>', '</mark>', '...', 64) as snippet,
        bm25(articles_fts) as score,
        'body' as matched_field
      FROM laws
      JOIN articles_fts ON laws.identifier = articles_fts.law_identifier
      WHERE articles_fts MATCH ?
    `;
    const ftsParams: (string | number)[] = [ftsQuery];

    if (jurisdiction) {
      ftsSql += " AND laws.jurisdiction = ?";
      ftsParams.push(jurisdiction);
    }

    if (status) {
      ftsSql += " AND laws.status = ?";
      ftsParams.push(status);
    }

    if (rank) {
      ftsSql += " AND laws.rank = ?";
      ftsParams.push(rank);
    }

    if (dateFrom) {
      ftsSql += " AND laws.publication_date >= ?";
      ftsParams.push(dateFrom);
    }

    if (dateTo) {
      ftsSql += " AND laws.publication_date <= ?";
      ftsParams.push(dateTo);
    }

    ftsSql += " ORDER BY score LIMIT ?";
    ftsParams.push(limit);

    let ftsRows: any[] = [];
    try {
      const ftsStmt = this.db.prepare(ftsSql);
      ftsRows = ftsStmt.all(...ftsParams) as any[];
    } catch {
      ftsRows = [];
    }

    let titleSql = `
      SELECT DISTINCT
        laws.*,
        laws.title as snippet,
        0 as score,
        'title' as matched_field
      FROM laws
      WHERE laws.title LIKE ?
    `;
    const titleParams: (string | number)[] = [`%${query}%`];

    if (jurisdiction) {
      titleSql += " AND laws.jurisdiction = ?";
      titleParams.push(jurisdiction);
    }

    if (status) {
      titleSql += " AND laws.status = ?";
      titleParams.push(status);
    }

    if (rank) {
      titleSql += " AND laws.rank = ?";
      titleParams.push(rank);
    }

    if (dateFrom) {
      titleSql += " AND laws.publication_date >= ?";
      titleParams.push(dateFrom);
    }

    if (dateTo) {
      titleSql += " AND laws.publication_date <= ?";
      titleParams.push(dateTo);
    }

    titleSql += " LIMIT ?";
    titleParams.push(limit);

    const titleStmt = this.db.prepare(titleSql);
    const titleRows = titleStmt.all(...titleParams) as any[];

    // Merge results, prioritizing FTS results
    const seenIds = new Set(ftsRows.map((row) => row.identifier));
    const mergedRows = [...ftsRows];

    for (const row of titleRows) {
      if (!seenIds.has(row.identifier)) {
        mergedRows.push(row);
        seenIds.add(row.identifier);
      }
    }

    return mergedRows.slice(0, limit).map((row) => ({
      citation: this.rowToCitation(row),
      snippet: row.snippet || "",
      score: Math.abs(Number(row.score ?? 0)),
      matched_fields: row.matched_field === "body" ? ["body"] : ["title"],
    }));
  }

  /**
   * Get law metadata by identifier.
   */
  getLawMetadata(identifier: string): LawRecord | null {
    const stmt = this.db.prepare(
      "SELECT * FROM laws WHERE identifier = ?",
    );
    const row = stmt.get(identifier) as any;

    if (!row) return null;

    return this.rowToLawRecord(row);
  }

  /**
   * Get article by law identifier and article number.
   */
  getArticle(
    identifier: string,
    articleNumber: string,
    maxChars: number = config.defaultArticleChars,
  ): Article | null {
    const stmt = this.db.prepare(
      "SELECT * FROM articles WHERE law_identifier = ? AND article_number = ? LIMIT 1",
    );
    const row = stmt.get(identifier, articleNumber) as any;

    if (!row) return null;

    const text = row.text;
    const truncated = text.length > maxChars;

    return {
      article_number: row.article_number,
      heading_path: JSON.parse(row.heading_path),
      text: truncated ? text.slice(0, maxChars) : text,
      truncated,
    };
  }

  /**
   * Search for excerpts within a law using FTS5.
   */
  searchExcerpts(
    identifier: string,
    query: string,
    maxChars: number = config.defaultExcerptChars,
    limit: number = config.defaultSearchLimit,
  ): Excerpt[] {
    let rows: any[];
    const ftsQuery = buildFtsQuery(query);
    
    try {
      const stmt = this.db.prepare(`
        SELECT
          a.heading_path,
          a.article_number,
          a.text,
          snippet(articles_fts, 4, '<mark>', '</mark>', '...', 64) as snippet,
          bm25(articles_fts) as score
        FROM articles_fts
        JOIN articles a ON a.id = articles_fts.rowid
        WHERE articles_fts MATCH ? AND a.law_identifier = ?
        ORDER BY score
        LIMIT ?
      `);

      rows = stmt.all(ftsQuery, identifier, limit) as any[];
    } catch {
      const fallbackStmt = this.db.prepare(`
        SELECT
          heading_path,
          article_number,
          text,
          '' as snippet,
          0 as score
        FROM articles
        WHERE law_identifier = ? AND text LIKE ?
        LIMIT ?
      `);

      rows = fallbackStmt.all(identifier, `%${query}%`, limit) as any[];
    }

    return rows.map((row) => {
      const text = row.text;
      const truncated = text.length > maxChars;

      return {
        heading_path: JSON.parse(row.heading_path),
        article_number: row.article_number,
        text: truncated ? text.slice(0, maxChars) : text,
        score: Math.abs(Number(row.score ?? 0)),
      };
    });
  }

  /**
   * List reforms for a law.
   */
  listReforms(
    identifier: string,
    dateFrom?: string,
    dateTo?: string,
    limit: number = config.defaultReformLimit,
  ): ReformListItem[] {
    let sql = "SELECT * FROM reforms WHERE law_identifier = ?";
    const params: (string | number)[] = [identifier];

    if (dateFrom) {
      sql += " AND date >= ?";
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += " AND date <= ?";
      params.push(dateTo);
    }

    sql += " ORDER BY date DESC LIMIT ?";
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => ({
      commit_sha: row.commit_sha,
      date: row.date,
      source_id: row.source_id,
      disposition_id: row.disposition_id,
      affected_articles: row.affected_articles
        ? JSON.parse(row.affected_articles)
        : null,
      summary: row.summary,
      github_commit_url: row.github_commit_url,
      source_url: row.source_url,
    }));
  }

  /**
   * Get database statistics.
   */
  getStats(): {
    lawCount: number;
    articleCount: number;
    reformCount: number;
  } {
    const lawCount = this.db
      .prepare("SELECT COUNT(*) as count FROM laws")
      .get() as { count: number };
    const articleCount = this.db
      .prepare("SELECT COUNT(*) as count FROM articles")
      .get() as { count: number };
    const reformCount = this.db
      .prepare("SELECT COUNT(*) as count FROM reforms")
      .get() as { count: number };

    return {
      lawCount: lawCount.count,
      articleCount: articleCount.count,
      reformCount: reformCount.count,
    };
  }

  /**
   * Close database connection.
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the underlying database instance (for testing).
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Convert database row to Citation object.
   */
  private rowToCitation(row: any): Citation {
    return {
      identifier: row.identifier,
      title: row.title,
      jurisdiction: row.jurisdiction,
      status: row.status,
      rank: row.rank,
      publication_date: row.publication_date,
      last_updated: row.last_updated,
      source_revision: row.source_revision,
      legalize_path: row.legalize_path,
      github_url: row.github_url,
      raw_url: row.raw_url,
      boe_url: row.boe_url,
      eli_url: row.eli_url,
    };
  }

  /**
   * Convert database row to LawRecord object.
   */
  private rowToLawRecord(row: any): LawRecord {
    return {
      identifier: row.identifier,
      title: row.title,
      jurisdiction: row.jurisdiction,
      status: row.status,
      rank: row.rank,
      publication_date: row.publication_date,
      last_updated: row.last_updated,
      source_revision: row.source_revision,
      legalize_path: row.legalize_path,
      github_url: row.github_url,
      raw_url: row.raw_url,
      boe_url: row.boe_url,
      eli_url: row.eli_url,
      url_html_consolidada: row.url_html_consolidada,
      url_pdf: row.url_pdf,
      department: row.department,
      subjects: row.subjects ? JSON.parse(row.subjects) : null,
      consolidation_status: row.consolidation_status,
      scope: row.scope,
      frontmatter: JSON.parse(row.frontmatter),
    };
  }
}

/**
 * Create or open a database at the specified path.
 */
export async function openDatabase(dbPath: string): Promise<LawDatabase> {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  await fs.mkdir(dir, { recursive: true });

  return new LawDatabase(dbPath);
}

/**
 * Create a new database at the specified path for staging.
 */
export async function createStagingDatabase(
  dbPath: string,
): Promise<LawDatabase> {
  try {
    await fs.unlink(dbPath);
  } catch (error) {
    const errnoError = error as NodeJS.ErrnoException;
    if (errnoError.code !== "ENOENT") {
      throw new Error(`Failed to remove existing staging database: ${errnoError.message}`);
    }
  }

  return openDatabase(dbPath);
}

function buildFtsQuery(query: string): string {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replaceAll('"', '""')}"`);

  return terms.length > 0 ? terms.join(" ") : '""';
}
