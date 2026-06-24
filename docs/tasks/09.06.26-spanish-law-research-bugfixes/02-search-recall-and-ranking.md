# Phase 02: Search Recall And Ranking

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Make `search_laws` robust for long Spanish legal queries while keeping the implementation lightweight, bounded, and source-grounded.

## Scope

- Query normalization.
- Accent-insensitive and case-insensitive matching.
- Narrow synonym and alias expansion for the reported legal concepts.
- FTS5 query construction that does not require every raw user token to match.
- Simple lexical scoring that favors exact phrase, article number, title, and high-value legal terms.
- Failure visibility for malformed FTS queries.

## Non-Goals

- Do not add vector search, embeddings, semantic indexes, model calls, or external reranking services.
- Do not build a broad legal reasoning layer in the server.
- Do not infer user-specific legal conclusions in retrieval code.

## Checklist

> Mark completed items as `[x]`.

- [ ] Replace all-token strict FTS matching with a bounded query strategy that can return results when only the legally meaningful subset matches.
- [ ] Normalize accents and common orthographic variants such as `autónomo` and `autonomo`.
- [ ] Add narrow synonym groups for the reported concepts, including `tarifa plana` / `cuota reducida`, `autonomos` / `trabajadores por cuenta propia`, and `SMI` / `salario minimo interprofesional`.
- [ ] Preserve article-number terms such as `38 ter` as high-value query signals.
- [ ] Search titles and article text with compatible normalization instead of relying on one full-query title `LIKE`.
- [ ] Keep the result limit behavior unchanged.
- [ ] Avoid blanket exception swallowing in FTS paths; log or propagate unexpected query failures through an explicit structured path.
- [ ] Return compact candidate sets with citations and snippets that let ChatGPT decide final relevance.
- [ ] Add database-level tests that assert the reported queries return the expected law when the fixture exists.
- [ ] Add tests for accent-insensitive and synonym-assisted retrieval.
- [ ] Commit: `git commit -m "Improve Spanish legal search recall"`

## Validation

- Both reported search queries return the expected law within `limit: 10`.
- Existing search tests continue to pass.
- Searches with unsupported jurisdiction, invalid dates, and excessive limits still fail through the existing structured validation path.
- Search response shape remains compatible with `docs/contracts/tools.md`.
- Search does not return duplicate laws after merging title and body matches.

## Dependencies / Risks

- Ranking should be asserted by top-result presence or top-N presence, not by exact score values.
- Synonym expansion must stay explicit and tested. Do not introduce broad legal inference rules.
- FTS5 query syntax must be escaped with structured helpers and covered by tests for punctuation, quotes, and long queries.
- Keep retrieval inexpensive enough to run inside the existing SQLite-backed MCP server.
