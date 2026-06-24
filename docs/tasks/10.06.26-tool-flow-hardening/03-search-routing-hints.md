# Phase 03: Search Routing Hints

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Help GPT immediately choose the correct follow-up `get_article` call by returning bounded article-level routing hints in `search_laws` results.

## Scope

- Optional search result fields for matched article candidates.
- Contract and schema updates.
- Database query changes that remain lightweight.
- Golden prompt tests for search-to-article sequencing.

## Checklist

> Mark completed items as `[x]`.

- [x] Extend search result output with an optional bounded `article_matches` field.
- [x] Include only compact fields in each article match: `article_number`, `heading_path`, `snippet`, and a score or match source if already available.
- [x] Ensure Article `38 ter` is surfaced in `article_matches` for the reported `cuota reducida` query.
- [x] Keep result size within existing MCP response limits.
- [x] Update `src/tools/schemas.ts`, `src/types/index.ts`, and `docs/contracts/tools.md`.
- [x] Update tests so GPT-facing golden prompts assert the intended sequence: use `citation.identifier` and `article_matches[0].article_number` for `get_article`.
- [x] Commit: `git commit -m "Add article routing hints to search results"`

## Validation

- [x] `search_laws` returns `BOE-A-2007-13409` with `article_matches` containing `38 ter` for the reported query.
- [x] Existing consumers that ignore `article_matches` remain compatible.
- [x] MCP output schema validates successful search responses.
- [x] `pnpm build` and focused search/MCP/golden tests pass.

## Dependencies / Risks

- Keep `article_matches` optional to avoid a breaking contract for title-only results.
- Do not add broad semantic ranking or large article text payloads to search results.
