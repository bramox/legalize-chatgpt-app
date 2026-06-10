import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { config } from "../config.js";
import { ATTRIBUTION, DISCLAIMER } from "../constants.js";
import type { LawDatabase } from "../store/database.js";
import {
  handleGetArticle,
  handleGetLawExcerpt,
  handleGetLawMetadata,
  handleListReforms,
  handleSearchLaws,
} from "../tools/handlers.js";
import {
  getArticleInputSchema,
  getArticleOutputSchema,
  getLawExcerptInputSchema,
  getLawExcerptOutputSchema,
  getLawMetadataInputSchema,
  getLawMetadataOutputSchema,
  listReformsInputSchema,
  listReformsOutputSchema,
  searchLawsInputSchema,
  searchLawsOutputSchema,
  type ToolResponse,
} from "../tools/schemas.js";

const toolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const toolsOnlyMeta = {
  ui: {
    visibility: ["model"],
  },
};

export const SERVER_INSTRUCTIONS = `
${DISCLAIMER}

${ATTRIBUTION}

This server provides read-only access to Spanish legislation through the following tools:
- search_laws: Find laws by topic, phrase, identifier, rank, status, jurisdiction, or date range.
- get_law_metadata: Get law metadata without article text.
- get_article: Get one article or bounded section.
- get_law_excerpt: Search for excerpts within a known law.
- list_reforms: View reform history for a law.

Preferred flow for natural-language questions:
1. Use search_laws by topic or phrase.
2. If a search result contains next_tool, call it directly to retrieve full article text before answering.
3. Otherwise, use the returned citation.identifier and article_matches[].article_number to call get_article.
4. Cite source citations when answering.

Important: Do not answer legal questions from search_laws snippets alone. Always retrieve full article text with get_article (via next_tool if present) before providing cited legal answers. If no result is found, retry with a shorter Spanish source-oriented local-corpus query and avoid optional filters unless the user explicitly requested them.

All tools return structured responses with source citations. Always cite the source when presenting legal information.
`.trim();

export function createMcpServer(db: LawDatabase): McpServer {
  const server = new McpServer(
    {
      name: "spanish-law-research",
      version: process.env.npm_package_version ?? "0.0.0",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
      capabilities: {
        tools: {},
      },
    },
  );

  server.registerTool(
    "search_laws",
    {
      description:
        "Find Spanish laws by topic or phrase. Returns citation.identifier, article_matches[].article_number, and next_tool for get_article calls. Use short source-oriented queries. If a result contains next_tool, call it directly to retrieve full article text before answering.",
      inputSchema: searchLawsInputSchema,
      outputSchema: searchLawsOutputSchema,
      annotations: toolAnnotations,
      _meta: toolsOnlyMeta,
    },
    async (args) => toToolResult(await withToolTimeout(handleSearchLaws(db, args))),
  );

  server.registerTool(
    "get_law_metadata",
    {
      description:
        "Use this when the user provides a stable law identifier and needs metadata without article text. Stable identifiers are required (e.g., BOE-A-2007-13409). Natural-language law names should be resolved with search_laws first.",
      inputSchema: getLawMetadataInputSchema,
      outputSchema: getLawMetadataOutputSchema,
      annotations: toolAnnotations,
      _meta: toolsOnlyMeta,
    },
    async (args) => toToolResult(await withToolTimeout(handleGetLawMetadata(db, args))),
  );

  server.registerTool(
    "get_article",
    {
      description:
        "Get one article or bounded section. Use citation.identifier and article_matches[].article_number from search_laws. Stable identifiers are required (e.g., BOE-A-2007-13409).",
      inputSchema: getArticleInputSchema,
      outputSchema: getArticleOutputSchema,
      annotations: toolAnnotations,
      _meta: toolsOnlyMeta,
    },
    async (args) => toToolResult(await withToolTimeout(handleGetArticle(db, args))),
  );

  server.registerTool(
    "get_law_excerpt",
    {
      description:
        "Use this when the user asks for a bounded excerpt about a topic inside a known law.",
      inputSchema: getLawExcerptInputSchema,
      outputSchema: getLawExcerptOutputSchema,
      annotations: toolAnnotations,
      _meta: toolsOnlyMeta,
    },
    async (args) => toToolResult(await withToolTimeout(handleGetLawExcerpt(db, args))),
  );

  server.registerTool(
    "list_reforms",
    {
      description: "Use this when the user asks how a law has changed over time.",
      inputSchema: listReformsInputSchema,
      outputSchema: listReformsOutputSchema,
      annotations: toolAnnotations,
      _meta: toolsOnlyMeta,
    },
    async (args) => toToolResult(await withToolTimeout(handleListReforms(db, args))),
  );

  return server;
}

export async function startMcpServerStdio(db: LawDatabase): Promise<void> {
  const server = createMcpServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function toToolResult(result: ToolResponse<Record<string, unknown>>): CallToolResult {
  const serialized = JSON.stringify(result, null, 2);
  if (Buffer.byteLength(serialized, "utf-8") > config.maxResponseSizeBytes) {
    const limitError = {
      ok: false as const,
      error: {
        code: "limit_exceeded" as const,
        message: "Tool response exceeded the maximum response size.",
        details: {
          max_response_size_bytes: config.maxResponseSizeBytes,
        },
      },
    };
    return {
      structuredContent: limitError,
      content: [
        {
          type: "text",
          text: JSON.stringify(limitError, null, 2),
        },
      ],
      isError: true,
    };
  }

  const content = [
    {
      type: "text" as const,
      text: serialized,
    },
  ];

  if (!result.ok) {
    return {
      structuredContent: result,
      content,
      isError: true,
    };
  }

  return {
    structuredContent: result,
    content,
  };
}

async function withToolTimeout<T extends ToolResponse<Record<string, unknown>>>(
  operation: Promise<T>,
): Promise<T | ToolResponse<Record<string, unknown>>> {
  let timeout: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      operation,
      new Promise<ToolResponse<Record<string, unknown>>>((resolve) => {
        timeout = setTimeout(() => {
          resolve({
            ok: false,
            error: {
              code: "limit_exceeded",
              message: "Tool execution exceeded the configured timeout.",
              details: {
                timeout_ms: config.sqliteQueryTimeoutMs,
              },
            },
          });
        }, config.sqliteQueryTimeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
