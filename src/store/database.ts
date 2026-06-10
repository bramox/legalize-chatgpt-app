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
  ArticleMatch,
  NextTool,
} from "../types/index.js";
import { config } from "../config.js";
import {
  canonicalizeArticleLabel,
  getArticleBaseNumber,
  hasSupportedArticleSuffix,
  isMalformedBaseArticleLabel,
  recoverCanonicalArticleNumber,
} from "../lib/article-labels.js";

/**
 * SQLite database store with FTS5 for full-text search.
 * Uses external-content FTS5 design to avoid duplicating article text.
 */
export class LawDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.function("_normalize_text", normalizeText);
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
   * Uses FTS5 for article/body matching with normalized title fallback.
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
    const normalizedStatus = normalizeStatusFilter(status);
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

    if (normalizedStatus) {
      ftsSql += " AND laws.status = ?";
      ftsParams.push(normalizedStatus);
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
    let ftsError: Error | null = null;

    try {
      const ftsStmt = this.db.prepare(ftsSql);
      ftsRows = ftsStmt.all(...ftsParams) as any[];
    } catch (error) {
      ftsError = error instanceof Error ? error : new Error(String(error));
      // Log the error but don't silently convert to empty results
      // Continue with title fallback
    }

    // Deduplicate FTS results by identifier, keeping the best (lowest) score for each law
    const ftsRowMap = new Map<string, any>();
    for (const row of ftsRows) {
      const existing = ftsRowMap.get(row.identifier);
      if (!existing || Math.abs(Number(row.score)) < Math.abs(Number(existing.score))) {
        ftsRowMap.set(row.identifier, row);
      }
    }
    ftsRows = Array.from(ftsRowMap.values());

    // Use case-insensitive title matching (keeping accents for accuracy)
    let titleSql = `
      SELECT DISTINCT
        laws.*,
        laws.title as snippet,
        0 as score,
        'title' as matched_field
      FROM laws
      WHERE LOWER(laws.title) LIKE LOWER(?)
    `;
    const titleParams: (string | number)[] = [`%${query}%`];

    if (jurisdiction) {
      titleSql += " AND laws.jurisdiction = ?";
      titleParams.push(jurisdiction);
    }

    if (normalizedStatus) {
      titleSql += " AND laws.status = ?";
      titleParams.push(normalizedStatus);
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

    // If FTS failed and we have no results, throw the error
    if (ftsError && mergedRows.length === 0) {
      throw ftsError;
    }

    // Fetch article matches for body-only results (not title-only matches)
    const results = mergedRows.slice(0, limit).map((row) => {
      const result: SearchResult = {
        citation: this.rowToCitation(row),
        snippet: row.snippet || "",
        score: Math.abs(Number(row.score ?? 0)),
        matched_fields: row.matched_field === "body" ? ["body"] : ["title"],
      };

      // Add article matches only for body matches (FTS results)
      if (row.matched_field === "body") {
        result.article_matches = this.fetchArticleMatches(row.identifier, ftsQuery, 3);

        // Add next_tool hint when article matches exist
        if (result.article_matches && result.article_matches.length > 0) {
          const nextTool: NextTool = {
            name: "get_article",
            arguments: {
              identifier: result.citation.identifier,
              article_number: result.article_matches[0].article_number,
              jurisdiction: result.citation.jurisdiction,
            },
          };
          result.next_tool = nextTool;
        }
      }

      return result;
    });

    return results;
  }

  /**
   * Fetch bounded article matches for a law using FTS.
   * Returns compact matches with article_number, heading_path, snippet, and score.
   */
  private fetchArticleMatches(
    lawIdentifier: string,
    ftsQuery: string,
    limit: number = 3,
  ): ArticleMatch[] {
    const stmt = this.db.prepare(`
      SELECT
        a.article_number,
        a.heading_path,
        snippet(articles_fts, 4, '<mark>', '</mark>', '...', 64) as snippet,
        bm25(articles_fts) as score
      FROM articles_fts
      JOIN articles a ON a.id = articles_fts.rowid
      WHERE articles_fts MATCH ? AND a.law_identifier = ?
      ORDER BY score
      LIMIT ?
    `);

    const rows = stmt.all(ftsQuery, lawIdentifier, limit) as any[];

    return rows.map((row) => {
      const canonical = canonicalizeArticleLabel(row.article_number);
      const displayNumber = canonical || row.article_number;

      return {
        article_number: displayNumber,
        heading_path: JSON.parse(row.heading_path),
        snippet: row.snippet || "",
        score: Math.abs(Number(row.score ?? 0)),
        matched_fields: ["body"],
      };
    });
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
   * Tries exact lookup first, then canonicalized variants.
   */
  getArticle(
    identifier: string,
    articleNumber: string,
    maxChars: number = config.defaultArticleChars,
  ): Article | null {
    // Try exact match first
    const stmt = this.db.prepare(
      "SELECT * FROM articles WHERE law_identifier = ? AND article_number = ? LIMIT 1",
    );
    let row = stmt.get(identifier, articleNumber) as any;

    if (row) {
      // Even if exact match succeeds, check if the stored value is malformed
      // and can be recovered to a canonical form
      const canonical = canonicalizeArticleLabel(articleNumber);
      if (canonical && canonical !== articleNumber) {
        const recovered = recoverCanonicalArticleNumber(row.article_number, canonical);
        if (recovered) {
          const text = row.text;
          const truncated = text.length > maxChars;

          return {
            article_number: recovered, // Return canonical article number
            heading_path: JSON.parse(row.heading_path),
            text: truncated ? text.slice(0, maxChars) : text,
            truncated,
          };
        }
      }

      const text = row.text;
      const truncated = text.length > maxChars;

      return {
        article_number: row.article_number,
        heading_path: JSON.parse(row.heading_path),
        text: truncated ? text.slice(0, maxChars) : text,
        truncated,
      };
    }

    // Try canonicalized article number
    const canonical = canonicalizeArticleLabel(articleNumber);
    if (canonical && canonical !== articleNumber) {
      row = stmt.get(identifier, canonical) as any;

      if (row) {
        const text = row.text;
        const truncated = text.length > maxChars;

        return {
          article_number: row.article_number,
          heading_path: JSON.parse(row.heading_path),
          text: truncated ? text.slice(0, maxChars) : text,
          truncated,
        };
      }
    }

    // Try legacy malformed compatibility fallback
    // Only for known suffix articles with legacy stored values like "38 "
    if (canonical) {
      const allArticlesStmt = this.db.prepare(
        "SELECT article_number FROM articles WHERE law_identifier = ?",
      );
      const allRows = allArticlesStmt.all(identifier) as any[];

      for (const existingRow of allRows) {
        const recovered = recoverCanonicalArticleNumber(
          existingRow.article_number,
          canonical,
        );
        if (recovered) {
          // Found a match via recovery, fetch the full article
          row = stmt.get(identifier, existingRow.article_number) as any;
          if (row) {
            const text = row.text;
            const truncated = text.length > maxChars;

            return {
              article_number: recovered, // Return canonical article number
              heading_path: JSON.parse(row.heading_path),
              text: truncated ? text.slice(0, maxChars) : text,
              truncated,
            };
          }
        }

        if (isMalformedBaseArticleLabel(articleNumber)) {
          const baseNumber = canonical;
          const storedBaseNumber = getArticleBaseNumber(existingRow.article_number);

          if (
            baseNumber &&
            hasSupportedArticleSuffix(existingRow.article_number) &&
            storedBaseNumber === baseNumber
          ) {
            // Check if there are multiple suffix articles for this base number (ambiguous)
            const suffixCount = allRows.filter(r => {
              const candidateBaseNumber = getArticleBaseNumber(r.article_number);
              return (
                candidateBaseNumber === baseNumber &&
                hasSupportedArticleSuffix(r.article_number)
              );
            }).length;

            // Only recover if unambiguous (exactly one suffix article for this base number)
            if (suffixCount === 1) {
              row = stmt.get(identifier, existingRow.article_number) as any;
              if (row) {
                const text = row.text;
                const truncated = text.length > maxChars;

                return {
                  article_number: existingRow.article_number, // Return the stored canonical article number
                  heading_path: JSON.parse(row.heading_path),
                  text: truncated ? text.slice(0, maxChars) : text,
                  truncated,
                };
              }
            }
          }
        }
      }
    }

    return null;
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
    let ftsError: Error | null = null;
    
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
    } catch (error) {
      ftsError = error instanceof Error ? error : new Error(String(error));
      // Fall back to LIKE search
      const fallbackStmt = this.db.prepare(`
        SELECT
          heading_path,
          article_number,
          text,
          '' as snippet,
          0 as score
        FROM articles
        WHERE law_identifier = ? AND LOWER(text) LIKE LOWER(?)
        LIMIT ?
      `);

      rows = fallbackStmt.all(identifier, `%${query}%`, limit) as any[];
    }

    // If both FTS and fallback failed, throw the error
    if (ftsError && rows.length === 0) {
      throw ftsError;
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
   * Find candidate laws by title, identifier, rank/year label, or normalized title fragments.
   * Returns bounded candidate metadata for structured error responses.
   */
  findLawCandidates(query: string, limit: number = 5): Array<{
    identifier: string;
    title: string;
    jurisdiction: string;
    status: string;
    rank: string | null;
    publication_date: string | null;
    last_updated: string;
    boe_url: string | null;
    eli_url: string | null;
  }> {
    const normalizedQuery = normalizeText(query);

    // Try exact identifier match first
    const exactStmt = this.db.prepare(
      "SELECT identifier, title, jurisdiction, status, rank, publication_date, last_updated, boe_url, eli_url FROM laws WHERE identifier = ? LIMIT 1"
    );
    const exactRow = exactStmt.get(query) as any;
    if (exactRow) {
      return [this.rowToLawCandidate(exactRow)];
    }

    // Try case-insensitive title match
    const titleStmt = this.db.prepare(
      "SELECT identifier, title, jurisdiction, status, rank, publication_date, last_updated, boe_url, eli_url FROM laws WHERE LOWER(title) LIKE LOWER(?) LIMIT ?"
    );
    const titleRows = titleStmt.all(`%${query}%`, limit) as any[];
    if (titleRows.length > 0) {
      return titleRows.map(row => this.rowToLawCandidate(row));
    }

    // Try normalized title fragment match
    const fragmentStmt = this.db.prepare(
      `SELECT identifier, title, jurisdiction, status, rank, publication_date, last_updated, boe_url, eli_url
       FROM laws
       WHERE LOWER(_normalize_text(title)) LIKE LOWER(?)
       LIMIT ?`
    );
    const fragmentRows = fragmentStmt.all(`%${normalizedQuery}%`, limit) as any[];
    if (fragmentRows.length > 0) {
      return fragmentRows.map(row => this.rowToLawCandidate(row));
    }

    // Try rank/year label match (e.g., "8/2015")
    const rankYearMatch = query.match(/^(\d+)\/(\d{4})$/);
    if (rankYearMatch) {
      const rankStmt = this.db.prepare(
        "SELECT identifier, title, jurisdiction, status, rank, publication_date, last_updated, boe_url, eli_url FROM laws WHERE rank LIKE ? OR title LIKE ? LIMIT ?"
      );
      const rankRows = rankStmt.all(`%${query}%`, `%${query}%`, limit) as any[];
      if (rankRows.length > 0) {
        return rankRows.map(row => this.rowToLawCandidate(row));
      }
    }

    return [];
  }

  /**
   * Find candidate articles within a law by nearby article numbers or relevant text.
   * Returns bounded article suggestions for structured error responses.
   * Always returns canonical article numbers for known suffix articles.
   */
  findArticleCandidates(
    lawIdentifier: string,
    articleNumber: string,
    limit: number = 5
  ): Array<{
    article_number: string;
    heading_path: string[];
    snippet: string;
  }> {
    // Try to parse the article number to find nearby articles
    const numericMatch = articleNumber.match(/^(\d+)/);
    const baseNumber = numericMatch ? parseInt(numericMatch[1], 10) : null;

    if (baseNumber !== null) {
      // Look for articles with nearby numbers (±3)
      const nearbyStmt = this.db.prepare(
        `SELECT article_number, heading_path, text
         FROM articles
         WHERE law_identifier = ?
         AND CAST(article_number AS INTEGER) BETWEEN ? AND ?
         ORDER BY ABS(CAST(article_number AS INTEGER) - ?)
         LIMIT ?`
      );

      const nearbyRows = nearbyStmt.all(
        lawIdentifier,
        Math.max(1, baseNumber - 3),
        baseNumber + 3,
        baseNumber,
        limit
      ) as any[];

      if (nearbyRows.length > 0) {
        return nearbyRows.map(row => {
          // Canonicalize article number to avoid returning malformed values like "38 "
          const canonical = canonicalizeArticleLabel(row.article_number);
          const displayNumber = canonical || row.article_number;

          return {
            article_number: displayNumber,
            heading_path: JSON.parse(row.heading_path),
            snippet: row.text.slice(0, 200) + (row.text.length > 200 ? "..." : ""),
          };
        });
      }
    }

    // Fallback: look for articles containing the article number as text
    const textStmt = this.db.prepare(
      `SELECT article_number, heading_path, text
       FROM articles
       WHERE law_identifier = ?
       AND LOWER(text) LIKE LOWER(?)
       LIMIT ?`
    );

    const textRows = textStmt.all(lawIdentifier, `%${articleNumber}%`, limit) as any[];
    if (textRows.length > 0) {
      return textRows.map(row => ({
        article_number: row.article_number,
        heading_path: JSON.parse(row.heading_path),
        snippet: row.text.slice(0, 200) + (row.text.length > 200 ? "..." : ""),
      }));
    }

    // Final fallback: return first few articles from the law
    const fallbackStmt = this.db.prepare(
      `SELECT article_number, heading_path, text
       FROM articles
       WHERE law_identifier = ?
       ORDER BY chunk_index
       LIMIT ?`
    );

    const fallbackRows = fallbackStmt.all(lawIdentifier, limit) as any[];
    return fallbackRows.map(row => ({
      article_number: row.article_number,
      heading_path: JSON.parse(row.heading_path),
      snippet: row.text.slice(0, 200) + (row.text.length > 200 ? "..." : ""),
    }));
  }

  /**
   * Get the underlying database instance (for testing).
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Convert database row to law candidate object.
   */
  private rowToLawCandidate(row: any): {
    identifier: string;
    title: string;
    jurisdiction: string;
    status: string;
    rank: string | null;
    publication_date: string | null;
    last_updated: string;
    boe_url: string | null;
    eli_url: string | null;
  } {
    return {
      identifier: row.identifier,
      title: row.title,
      jurisdiction: row.jurisdiction,
      status: row.status,
      rank: row.rank,
      publication_date: row.publication_date,
      last_updated: row.last_updated,
      boe_url: row.boe_url,
      eli_url: row.eli_url,
    };
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

/**
 * Normalize text for accent-insensitive and case-insensitive matching.
 * Converts accented characters to their base form and lowercases.
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeStatusFilter(status: string | undefined): string | undefined {
  if (!status) {
    return undefined;
  }

  const normalized = normalizeText(status).trim().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    en_vigor: "in_force",
    in_force: "in_force",
    vigente: "in_force",
  };

  return aliases[normalized] ?? status;
}

/**
 * Narrow synonym groups for Spanish legal concepts.
 * Maps terms to their canonical form for expansion.
 * Keys are the canonical form; values are the aliases.
 */
const SYNONYM_GROUPS: Record<string, string[]> = {
  "tarifa plana": ["cuota reducida"],
  "cuota reducida": ["tarifa plana"],
  "autonomos": ["autónomos", "trabajadores por cuenta propia"],
  "autónomos": ["autonomos", "trabajadores por cuenta propia"],
  "trabajadores por cuenta propia": ["autonomos", "autónomos"],
  "smi": ["salario minimo interprofesional"],
  "salario minimo interprofesional": ["smi"],
  "segundo año": ["segundo periodo"],
  "segundo periodo": ["segundo año"],
};

/**
 * Expand query with phrase-based synonym matching before tokenization.
 * Checks the normalized full query for multi-word alias keys and adds their synonyms.
 * Returns the expanded query string.
 */
function expandWithPhraseSynonyms(query: string): string {
  const normalizedQuery = normalizeText(query);
  let expandedQuery = query;

  // Sort keys by length (longest first) to match longer phrases first
  const sortedKeys = Object.keys(SYNONYM_GROUPS).sort(
    (a, b) => b.length - a.length,
  );

  for (const key of sortedKeys) {
    const normalizedKey = normalizeText(key);
    const synonyms = SYNONYM_GROUPS[key];

    // Check if the normalized query contains this key as a phrase
    if (normalizedQuery.includes(normalizedKey)) {
      // Find the actual substring in the original query (preserving accents/case)
      // We need to find where this phrase appears in the original query
      const keyIndex = findNormalizedSubstringIndex(query, key);
      if (keyIndex !== -1) {
        // Add all synonyms to the query
        for (const synonym of synonyms) {
          // Avoid adding duplicate synonyms
          const normalizedSynonym = normalizeText(synonym);
          if (!normalizedQuery.includes(normalizedSynonym)) {
            expandedQuery += " " + synonym;
          }
        }
      }
    }
  }

  return expandedQuery;
}

/**
 * Find the index of a normalized substring within a string.
 * Returns -1 if not found.
 */
function findNormalizedSubstringIndex(
  text: string,
  substring: string,
): number {
  const normalizedText = normalizeText(text);
  const normalizedSubstring = normalizeText(substring);

  const index = normalizedText.indexOf(normalizedSubstring);
  if (index === -1) {
    return -1;
  }

  // Map the index back to the original text
  // This is approximate but should work for our use case
  let originalIndex = 0;
  let normalizedIndex = 0;

  for (let i = 0; i < text.length && normalizedIndex < index; i++) {
    const char = text[i];
    const normalizedChar = normalizeText(char);
    if (normalizedChar.length > 0) {
      normalizedIndex += normalizedChar.length;
    }
    originalIndex = i;
  }

  return originalIndex;
}

/**
 * Expand query terms with synonyms while preserving article numbers.
 * Returns a set of terms including originals and their synonyms.
 */
function expandWithSynonyms(terms: string[]): Set<string> {
  const expandedTerms = new Set<string>(terms);

  for (const term of terms) {
    const normalizedTerm = normalizeText(term);

    // Check if this term matches any synonym group key
    for (const [key, synonyms] of Object.entries(SYNONYM_GROUPS)) {
      const normalizedKey = normalizeText(key);
      if (normalizedTerm === normalizedKey) {
        // Add all synonyms for this group
        for (const synonym of synonyms) {
          expandedTerms.add(synonym);
        }
      }
    }
  }

  return expandedTerms;
}

/**
 * Detect if a term looks like an article number (e.g., "38", "38 ter", "1º", "1 bis").
 * These should be preserved as exact phrase matches.
 * Only numeric article references with optional legal suffixes are treated as article numbers.
 * Ordinary alphabetic words are treated as content terms eligible for synonym expansion.
 */
function isArticleNumberTerm(term: string): boolean {
  const normalized = normalizeText(term);
  // Match digits, optionally followed by space and short alphabetic suffixes (ter, bis, etc.)
  return /^\d+(\s+[a-záéíóúñ]+)?$/.test(normalized);
}

/**
 * Build FTS5 query from search terms with flexible matching.
 * Uses OR for expanded terms to allow subset matching, but preserves
 * article numbers as high-value exact phrase signals.
 * For short queries (<= 3 terms), uses AND for precision.
 * For long queries (> 3 terms), uses OR for better recall.
 */
function buildFtsQuery(query: string): string {
  // First, expand phrase-based synonyms before tokenization
  const expandedQuery = expandWithPhraseSynonyms(query);

  const terms = expandedQuery
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return '""';
  }

  // Separate article number terms from content terms
  const articleTerms: string[] = [];
  const contentTerms: string[] = [];

  for (const term of terms) {
    if (isArticleNumberTerm(term)) {
      articleTerms.push(term);
    } else {
      contentTerms.push(term);
    }
  }

  // Expand content terms with synonyms
  const expandedContentTerms = expandWithSynonyms(contentTerms);

  // Build query parts
  const queryParts: string[] = [];

  // Add all article terms as phrase matches
  for (const term of articleTerms) {
    queryParts.push(`"${term.replaceAll('"', '""')}"`);
  }

  // Add expanded content terms
  for (const term of expandedContentTerms) {
    queryParts.push(`"${term.replaceAll('"', '""')}"`);
  }

  // Use AND for short queries (better precision), OR for long queries (better recall)
  const useOr = terms.length > 3 || expandedContentTerms.size > 5;
  const operator = useOr ? " OR " : " AND ";

  return queryParts.length > 0 ? queryParts.join(operator) : '""';
}
