import * as z from "zod/v4";
import { config } from "../config.js";
import type {
  Article,
  ArticleMatch,
  Citation,
  Excerpt,
  Jurisdiction,
  LawMetadata,
  ReformListItem,
  SearchResult,
  ToolError,
  ToolErrorCode,
} from "../types/index.js";

const jurisdictionValues = [
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
] as const satisfies readonly Jurisdiction[];

export const SUPPORTED_JURISDICTIONS: Jurisdiction[] = [...jurisdictionValues];

export const toolErrorCodes = [
  "invalid_input",
  "unsupported_jurisdiction",
  "unknown_law",
  "unknown_article",
  "ambiguous_query",
  "source_unavailable",
  "limit_exceeded",
] as const satisfies readonly ToolErrorCode[];

const identifierSchema = z.string().min(3).max(80);
const articleNumberSchema = z.string().min(1).max(40);
const querySchema = z.string().trim().min(2).max(300);
const cursorSchema = z.string().min(1).max(500);
const jurisdictionSchema = z.enum(jurisdictionValues);
const dateSchema = z.string().refine(isValidDate, {
  message: "Date must use YYYY-MM-DD format.",
});

export const searchLawsInputSchema = z
  .object({
    query: querySchema,
    jurisdiction: jurisdictionSchema.optional(),
    status: z.string().min(1).max(80).optional(),
    rank: z.string().min(1).max(80).optional(),
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(config.maxSearchResults)
      .default(config.defaultSearchLimit),
    cursor: cursorSchema.optional(),
  })
  .strict();

export const getLawMetadataInputSchema = z
  .object({
    identifier: identifierSchema,
    jurisdiction: jurisdictionSchema.optional(),
  })
  .strict();

export const getArticleInputSchema = z
  .object({
    identifier: identifierSchema,
    article_number: articleNumberSchema,
    jurisdiction: jurisdictionSchema.optional(),
    max_chars: z
      .number()
      .int()
      .min(1000)
      .max(config.maxArticleChars)
      .default(config.defaultArticleChars),
  })
  .strict();

export const getLawExcerptInputSchema = z
  .object({
    identifier: identifierSchema,
    query: querySchema,
    jurisdiction: jurisdictionSchema.optional(),
    max_chars: z
      .number()
      .int()
      .min(1000)
      .max(config.maxExcerptChars)
      .default(config.defaultExcerptChars),
  })
  .strict();

export const listReformsInputSchema = z
  .object({
    identifier: identifierSchema,
    jurisdiction: jurisdictionSchema.optional(),
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(config.maxReformResults)
      .default(config.defaultReformLimit),
    cursor: cursorSchema.optional(),
  })
  .strict();

export const sharedCitationSchema = z
  .object({
    identifier: z.string(),
    title: z.string(),
    jurisdiction: z.string(),
    status: z.string(),
    rank: z.string().nullable(),
    publication_date: z.string().nullable(),
    last_updated: z.string(),
    source_revision: z.string(),
    legalize_path: z.string(),
    github_url: z.string(),
    raw_url: z.string(),
    boe_url: z.string().nullable(),
    eli_url: z.string().nullable(),
  })
  .strict();

export const toolErrorSchema = z
  .object({
    code: z.enum(toolErrorCodes),
    message: z.string(),
    details: z.record(z.string(), z.unknown()),
  })
  .strict();

const articleMatchSchema = z
  .object({
    article_number: z.string(),
    heading_path: z.array(z.string()),
    snippet: z.string(),
    score: z.number().optional(),
    matched_fields: z.array(z.string()).optional(),
  })
  .strict();

const nextToolSchema = z
  .object({
    name: z.literal("get_article"),
    arguments: z
      .object({
        identifier: z.string(),
        article_number: z.string(),
        jurisdiction: z.string(),
      })
      .strict(),
  })
  .strict();

const searchResultSchema = z
  .object({
    citation: sharedCitationSchema,
    snippet: z.string(),
    score: z.number(),
    matched_fields: z.array(z.string()),
    article_matches: z.array(articleMatchSchema).optional(),
    next_tool: nextToolSchema.optional(),
  })
  .strict();

const metadataSchema = z
  .object({
    department: z.string().nullable(),
    subjects: z.array(z.string()).nullable(),
    consolidation_status: z.string().nullable(),
    scope: z.string().nullable(),
    frontmatter: z.record(z.string(), z.unknown()),
  })
  .strict();

const articleSchema = z
  .object({
    article_number: z.string(),
    heading_path: z.array(z.string()),
    text: z.string(),
    truncated: z.boolean(),
  })
  .strict();

const excerptSchema = z
  .object({
    heading_path: z.array(z.string()),
    article_number: z.string(),
    text: z.string(),
    score: z.number(),
  })
  .strict();

const reformSchema = z
  .object({
    commit_sha: z.string(),
    date: z.string(),
    source_id: z.string().nullable(),
    disposition_id: z.string().nullable(),
    affected_articles: z.array(z.string()).nullable(),
    summary: z.string(),
    github_commit_url: z.string(),
    source_url: z.string().nullable(),
  })
  .strict();

export const searchLawsOutputSchema = z
  .object({
    ok: z.literal(true),
    results: z.array(searchResultSchema),
    next_cursor: z.string().nullable(),
  })
  .strict();

export const getLawMetadataOutputSchema = z
  .object({
    ok: z.literal(true),
    citation: sharedCitationSchema,
    metadata: metadataSchema,
  })
  .strict();

export const getArticleOutputSchema = z
  .object({
    ok: z.literal(true),
    citation: sharedCitationSchema,
    article: articleSchema,
  })
  .strict();

export const getLawExcerptOutputSchema = z
  .object({
    ok: z.literal(true),
    citation: sharedCitationSchema,
    excerpts: z.array(excerptSchema),
  })
  .strict();

export const listReformsOutputSchema = z
  .object({
    ok: z.literal(true),
    citation: sharedCitationSchema,
    reforms: z.array(reformSchema),
    next_cursor: z.string().nullable(),
  })
  .strict();

export type SearchLawsInput = z.infer<typeof searchLawsInputSchema>;
export type GetLawMetadataInput = z.infer<typeof getLawMetadataInputSchema>;
export type GetArticleInput = z.infer<typeof getArticleInputSchema>;
export type GetLawExcerptInput = z.infer<typeof getLawExcerptInputSchema>;
export type ListReformsInput = z.infer<typeof listReformsInputSchema>;

export type SharedCitation = Citation;
export type SearchLawsOutput = SearchResult;
export type Reform = ReformListItem;

export type ToolFailure = {
  ok: false;
  error: ToolError;
};

export type ToolResponse<T extends Record<string, unknown>> =
  | ({ ok: true } & T)
  | ToolFailure;

export type SearchLawsResponse = ToolResponse<{
  results: SearchResult[];
  next_cursor: string | null;
}>;

export type GetLawMetadataResponse = ToolResponse<{
  citation: Citation;
  metadata: LawMetadata;
}>;

export type GetArticleResponse = ToolResponse<{
  citation: Citation;
  article: Article;
}>;

export type GetLawExcerptResponse = ToolResponse<{
  citation: Citation;
  excerpts: Excerpt[];
}>;

export type ListReformsResponse = ToolResponse<{
  citation: Citation;
  reforms: ReformListItem[];
  next_cursor: string | null;
}>;

export function isValidJurisdiction(value: string): value is Jurisdiction {
  return SUPPORTED_JURISDICTIONS.includes(value as Jurisdiction);
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidIdentifier(value: string): boolean {
  return typeof value === "string" && value.length >= 3 && value.length <= 80;
}

export function isValidArticleNumber(value: string): boolean {
  return typeof value === "string" && value.length >= 1 && value.length <= 40;
}

export function isValidQuery(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 300;
}

export function validateLimit(
  value: number | undefined,
  min: number,
  max: number,
  defaultValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`limit must be an integer between ${min} and ${max}`);
  }

  return value;
}

export function validateMaxChars(
  value: number | undefined,
  min: number,
  max: number,
  defaultValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`max_chars must be an integer between ${min} and ${max}`);
  }

  return value;
}
