/**
 * Application constants.
 */

export const SERVICE_NAME = "Spanish Law Research";

export const DISCLAIMER =
  "This tool provides legal research information from Spanish legislation sources. " +
  "It is not legal advice and should not be used as a substitute for professional legal counsel.";

export const ATTRIBUTION =
  "Legislative data sourced from legalize-dev/legalize-es, which is based on official BOE publications. " +
  "Repository structure and metadata are MIT-licensed. Legislative content is in the public domain.";

export const TOOL_ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "The provided input is invalid.",
  unsupported_jurisdiction: "The specified jurisdiction is not supported.",
  unknown_law: "No law was found for the supplied identifier.",
  unknown_article: "The specified article was not found in the law.",
  ambiguous_query: "The query is ambiguous and matches multiple results.",
  source_unavailable: "The data source is temporarily unavailable.",
  limit_exceeded: "The request exceeds the allowed limits.",
};