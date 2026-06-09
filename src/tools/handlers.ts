import type { LawDatabase } from "../store/database.js";
import type { Citation, LawRecord, ToolErrorCode } from "../types/index.js";
import type { ZodType } from "zod/v4";
import { config } from "../config.js";
import {
  getArticleInputSchema,
  getLawExcerptInputSchema,
  getLawMetadataInputSchema,
  listReformsInputSchema,
  searchLawsInputSchema,
  type GetArticleInput,
  type GetArticleResponse,
  type GetLawExcerptInput,
  type GetLawExcerptResponse,
  type GetLawMetadataInput,
  type GetLawMetadataResponse,
  type ListReformsInput,
  type ListReformsResponse,
  type SearchLawsInput,
  type SearchLawsResponse,
  type ToolFailure,
} from "./schemas.js";

type ParseResult<T> =
  | {
      ok: true;
      value: T;
    }
  | ToolFailure;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

interface HandlerCaches {
  search: Map<string, CacheEntry<SearchLawsResponse>>;
  metadata: Map<string, CacheEntry<GetLawMetadataResponse>>;
  article: Map<string, CacheEntry<GetArticleResponse>>;
  excerpt: Map<string, CacheEntry<GetLawExcerptResponse>>;
}

const handlerCaches = new WeakMap<LawDatabase, HandlerCaches>();

export async function handleSearchLaws(
  db: LawDatabase,
  input: unknown,
): Promise<SearchLawsResponse> {
  const parsed = parseInput(searchLawsInputSchema, input);
  if (!parsed.ok) return parsed;

  const args: SearchLawsInput = parsed.value;
  const cacheKey = JSON.stringify(args);
  const cached = getCached(getCaches(db).search, cacheKey);
  if (cached) return cached;

  const results = db.searchLaws(
    args.query,
    args.jurisdiction,
    args.status,
    args.rank,
    args.date_from,
    args.date_to,
    args.limit,
  );

  return setCached(getCaches(db).search, cacheKey, {
    ok: true,
    results,
    next_cursor: null,
  });
}

export async function handleGetLawMetadata(
  db: LawDatabase,
  input: unknown,
): Promise<GetLawMetadataResponse> {
  const parsed = parseInput(getLawMetadataInputSchema, input);
  if (!parsed.ok) return parsed;

  const args: GetLawMetadataInput = parsed.value;
  const cacheKey = JSON.stringify(args);
  const cached = getCached(getCaches(db).metadata, cacheKey);
  if (cached) return cached;

  const law = getLawForRequest(db, args.identifier, args.jurisdiction);
  if (!law.ok) return law;

  return setCached(getCaches(db).metadata, cacheKey, {
    ok: true,
    citation: citationFromLaw(law.value),
    metadata: {
      department: law.value.department,
      subjects: law.value.subjects,
      consolidation_status: law.value.consolidation_status,
      scope: law.value.scope,
      frontmatter: law.value.frontmatter,
    },
  });
}

export async function handleGetArticle(
  db: LawDatabase,
  input: unknown,
): Promise<GetArticleResponse> {
  const parsed = parseInput(getArticleInputSchema, input);
  if (!parsed.ok) return parsed;

  const args: GetArticleInput = parsed.value;
  const cacheKey = JSON.stringify(args);
  const cached = getCached(getCaches(db).article, cacheKey);
  if (cached) return cached;

  const law = getLawForRequest(db, args.identifier, args.jurisdiction);
  if (!law.ok) return law;

  const article = db.getArticle(args.identifier, args.article_number, args.max_chars);
  if (!article) {
    return toolError("unknown_article", "The specified article was not found in the law.", {
      identifier: args.identifier,
      article_number: args.article_number,
    });
  }

  return setCached(getCaches(db).article, cacheKey, {
    ok: true,
    citation: citationFromLaw(law.value),
    article,
  });
}

export async function handleGetLawExcerpt(
  db: LawDatabase,
  input: unknown,
): Promise<GetLawExcerptResponse> {
  const parsed = parseInput(getLawExcerptInputSchema, input);
  if (!parsed.ok) return parsed;

  const args: GetLawExcerptInput = parsed.value;
  const cacheKey = JSON.stringify(args);
  const cached = getCached(getCaches(db).excerpt, cacheKey);
  if (cached) return cached;

  const law = getLawForRequest(db, args.identifier, args.jurisdiction);
  if (!law.ok) return law;

  const excerpts = db.searchExcerpts(args.identifier, args.query, args.max_chars);

  return setCached(getCaches(db).excerpt, cacheKey, {
    ok: true,
    citation: citationFromLaw(law.value),
    excerpts,
  });
}

export async function handleListReforms(
  db: LawDatabase,
  input: unknown,
): Promise<ListReformsResponse> {
  const parsed = parseInput(listReformsInputSchema, input);
  if (!parsed.ok) return parsed;

  const args: ListReformsInput = parsed.value;
  const law = getLawForRequest(db, args.identifier, args.jurisdiction);
  if (!law.ok) return law;

  const reforms = db.listReforms(
    args.identifier,
    args.date_from,
    args.date_to,
    args.limit,
  );

  return {
    ok: true,
    citation: citationFromLaw(law.value),
    reforms,
    next_cursor: null,
  };
}

export function citationFromLaw(law: LawRecord): Citation {
  return {
    identifier: law.identifier,
    title: law.title,
    jurisdiction: law.jurisdiction,
    status: law.status,
    rank: law.rank,
    publication_date: law.publication_date,
    last_updated: law.last_updated,
    source_revision: law.source_revision,
    legalize_path: law.legalize_path,
    github_url: law.github_url,
    raw_url: law.raw_url,
    boe_url: law.boe_url,
    eli_url: law.eli_url,
  };
}

function getLawForRequest(
  db: LawDatabase,
  identifier: string,
  jurisdiction: string | undefined,
): ParseResult<LawRecord> {
  const law = db.getLawMetadata(identifier);
  if (!law) {
    return toolError("unknown_law", "No law was found for the supplied identifier.", {
      identifier,
    });
  }

  if (jurisdiction && law.jurisdiction !== jurisdiction) {
    return toolError(
      "unknown_law",
      "No law was found for the supplied identifier in the requested jurisdiction.",
      {
        identifier,
        jurisdiction,
      },
    );
  }

  return {
    ok: true,
    value: law,
  };
}

function parseInput<T>(schema: ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return {
      ok: true,
      value: result.data,
    };
  }

  const hasJurisdictionIssue = result.error.issues.some(
    (issue) => issue.path[0] === "jurisdiction",
  );
  if (hasJurisdictionIssue) {
    return toolError("unsupported_jurisdiction", "The requested jurisdiction is not supported.", {
      jurisdiction: readInputProperty(input, "jurisdiction"),
    });
  }

  return toolError("invalid_input", "Input does not match the tool schema.", {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function getCaches(db: LawDatabase): HandlerCaches {
  const existing = handlerCaches.get(db);
  if (existing) {
    return existing;
  }

  const caches: HandlerCaches = {
    search: new Map(),
    metadata: new Map(),
    article: new Map(),
    excerpt: new Map(),
  };
  handlerCaches.set(db, caches);
  return caches;
}

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): T {
  cache.set(key, {
    expiresAt: Date.now() + config.cacheTtlMs,
    value,
  });

  if (cache.size > config.cacheMaxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  return value;
}

function readInputProperty(input: unknown, key: string): unknown {
  if (!input || typeof input !== "object" || !(key in input)) {
    return undefined;
  }

  return input[key as keyof typeof input];
}

function toolError(
  code: ToolErrorCode,
  message: string,
  details: Record<string, unknown>,
): ToolFailure {
  return {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  };
}
