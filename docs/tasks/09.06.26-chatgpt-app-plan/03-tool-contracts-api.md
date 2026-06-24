# Phase 03: Tool Contracts And API

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Define a small, predictable read-only tool surface that ChatGPT can call reliably and that always returns structured legal citations.

## Scope

- MCP tool inventory.
- Input and output schemas.
- Internal service API contracts.
- Citation and legal disclaimer behavior.
- Error handling, rate limits, and response size limits.

## Checklist

> Mark completed items as `[x]`.

- [x] Define `search_laws` for keyword search with filters for jurisdiction, status, rank, date range, and result limit.
- [x] Define `get_law_metadata` for retrieving frontmatter-derived metadata by stable identifier.
- [x] Define `get_article` for retrieving one article or a bounded section by identifier and article number.
- [x] Define `get_law_excerpt` for bounded text retrieval when the user asks for a topic inside a specific law.
- [x] Define `list_reforms` for reform history by law identifier.
- [x] Define `compare_reform` for comparing a specific law between two known revisions or reform commits.
- [x] Implement the exact v1 contracts from `docs/contracts/tools.md`.
- [x] Define a shared citation object with `identifier`, `title`, `jurisdiction`, `status`, `last_updated`, source revision, Legalize file path, GitHub source link, BOE source link, and nullable optional URLs.
- [x] Define a discriminated structured error union for unknown law, unknown article, ambiguous query, unsupported jurisdiction, source unavailable, invalid input, and limit exceeded.
- [x] Define pagination or cursor behavior for search and reform history before implementation.
- [x] Mark all tools as read-only in tool annotations.
- [x] Keep one user intent per tool. Do not create a broad catch-all legal assistant tool.
- [x] Require every successful response to include `identifier`, `title`, `jurisdiction`, `last_updated`, source revision, and source links where available.
- [x] Return bounded structured data first and narrative text second.
- [x] Define explicit error responses for unknown law, unknown article, ambiguous query, unsupported jurisdiction, source unavailable, invalid input, and limit exceeded.
- [x] Add a standard legal research disclaimer for app-level UI and documentation, not as noisy boilerplate inside every tool response.
- [x] Document rate limits and maximum response sizes before implementation.
- [x] Commit: `git commit -m "Define read-only legal research tool contracts"`

## Validation

- [x] Golden prompts map to exactly one primary tool in most cases.
- [x] Ambiguous prompts return clarification-oriented structured errors instead of guessing.
- [x] Tool schemas reject unsupported jurisdictions, invalid dates, excessive limits, and malformed identifiers.
- [x] Tool outputs include source citation fields even when the text excerpt is short.
- [x] Contract examples cover nullable `url_eli`, missing affected-article markers, empty reform history, and oversized article text.
- [x] No tool performs write, delete, publish, or user-account actions.

## Dependencies / Risks

- Tool names and descriptions are part of the product UX. Rehearse them against real prompts before implementation.
- Returning full laws can exceed practical response limits. Prefer article and excerpt tools.
- Legal outputs must remain research assistance, not legal advice.
