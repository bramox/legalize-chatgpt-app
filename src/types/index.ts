/**
 * Shared citation fields for all tool responses.
 * Preserves attribution and provenance for Legalize, legalize-es, and BOE sources.
 */
export interface Citation {
  identifier: string;
  title: string;
  jurisdiction: string;
  status: string;
  rank: string | null;
  publication_date: string | null;
  last_updated: string;
  source_revision: string;
  legalize_path: string;
  github_url: string;
  raw_url: string;
  boe_url: string | null;
  eli_url: string | null;
}

/**
 * Law record with metadata from YAML frontmatter.
 */
export interface LawRecord {
  identifier: string;
  title: string;
  jurisdiction: string;
  status: string;
  rank: string | null;
  publication_date: string | null;
  last_updated: string;
  source_revision: string;
  legalize_path: string;
  github_url: string;
  raw_url: string;
  boe_url: string | null;
  eli_url: string | null;
  url_html_consolidada: string | null;
  url_pdf: string | null;
  department: string | null;
  subjects: string[] | null;
  consolidation_status: string | null;
  scope: string | null;
  frontmatter: Record<string, unknown>;
}

/**
 * Article/section chunk from Markdown parsing.
 */
export interface ArticleChunk {
  law_identifier: string;
  jurisdiction: string;
  article_number: string;
  heading_path: string[];
  text: string;
  source_revision: string;
  legalize_path: string;
  chunk_index: number;
}

/**
 * Reform record extracted from Git commit metadata.
 */
export interface ReformRecord {
  law_identifier: string;
  commit_sha: string;
  date: string;
  source_id: string | null;
  disposition_id: string | null;
  affected_articles: string[] | null;
  summary: string;
  github_commit_url: string;
  source_url: string | null;
}

/**
 * Sync state for tracking corpus updates.
 */
export interface SyncState {
  last_checked_at: string;
  last_successful_sync_at: string | null;
  last_indexed_revision: string | null;
  last_seen_remote_revision: string | null;
  law_count: number;
  chunk_count: number;
  reform_count: number;
  skipped_count: number;
  error_count: number;
}

/**
 * Structured tool error.
 */
export interface ToolError {
  code: ToolErrorCode;
  message: string;
  details: Record<string, unknown>;
}

export type ToolErrorCode =
  | "invalid_input"
  | "unsupported_jurisdiction"
  | "unknown_law"
  | "unknown_article"
  | "ambiguous_query"
  | "source_unavailable"
  | "limit_exceeded";

/**
 * Article match hint for search-to-article routing.
 */
export interface ArticleMatch {
  article_number: string;
  heading_path: string[];
  snippet: string;
  score?: number;
  matched_fields?: string[];
}

/**
 * Suggested next tool call for search-to-article routing.
 * Scoped to get_article with identifier, article_number, and jurisdiction.
 */
export interface NextTool {
  name: "get_article";
  arguments: {
    identifier: string;
    article_number: string;
    jurisdiction: string;
  };
}

/**
 * Search result with citation and snippet.
 */
export interface SearchResult {
  citation: Citation;
  snippet: string;
  score: number;
  matched_fields: string[];
  article_matches?: ArticleMatch[];
  next_tool?: NextTool;
}

/**
 * Law metadata response.
 */
export interface LawMetadata {
  department: string | null;
  subjects: string[] | null;
  consolidation_status: string | null;
  scope: string | null;
  frontmatter: Record<string, unknown>;
}

/**
 * Article response.
 */
export interface Article {
  article_number: string;
  heading_path: string[];
  text: string;
  truncated: boolean;
}

/**
 * Excerpt result.
 */
export interface Excerpt {
  heading_path: string[];
  article_number: string;
  text: string;
  score: number;
}

/**
 * Reform list item.
 */
export interface ReformListItem {
  commit_sha: string;
  date: string;
  source_id: string | null;
  disposition_id: string | null;
  affected_articles: string[] | null;
  summary: string;
  github_commit_url: string;
  source_url: string | null;
}

/**
 * Parsed YAML frontmatter from a law file.
 */
export interface LawFrontmatter {
  identifier: string;
  title: string;
  country: string;
  rank?: string;
  publication_date?: string;
  last_updated: string;
  status: string;
  source?: string;
  url_eli?: string;
  url_html_consolidada?: string;
  url_pdf?: string;
  department?: string;
  subjects?: string[];
  consolidation_status?: string;
  scope?: string;
  [key: string]: unknown;
}

/**
 * Supported jurisdictions.
 */
export type Jurisdiction =
  | "es"
  | "es-an"
  | "es-ar"
  | "es-as"
  | "es-cb"
  | "es-cl"
  | "es-cm"
  | "es-cn"
  | "es-ct"
  | "es-ex"
  | "es-ga"
  | "es-ib"
  | "es-mc"
  | "es-md"
  | "es-nc"
  | "es-pv"
  | "es-ri"
  | "es-vc";

export const SUPPORTED_JURISDICTIONS: Jurisdiction[] = [
  "es",
  "es-an",
  "es-ar",
  "es-as",
  "es-cb",
  "es-cl",
  "es-cm",
  "es-cn",
  "es-ct",
  "es-ex",
  "es-ga",
  "es-ib",
  "es-mc",
  "es-md",
  "es-nc",
  "es-pv",
  "es-ri",
  "es-vc",
];
