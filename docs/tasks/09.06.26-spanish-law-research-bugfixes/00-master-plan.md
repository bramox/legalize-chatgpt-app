# Spanish Law Research Bug Fixes Master Plan

## Goal

Fix the reported Spanish Law Research failures where user queries about the second year of the reduced self-employed worker contribution regime return no useful results, and where an article lookup with a mismatched law label and article number is blocked or fails without a helpful structured recovery path.

## Bug Report Conclusion

The report identifies two connected defects:

- `search_laws` has insufficient recall for long Spanish legal queries that combine common terms, layperson phrasing, and statutory concepts such as `cuota reducida`, `tarifa plana`, `autonomos`, `segundo ano`, `rendimientos netos`, and `salario minimo interprofesional`.
- `get_article` accepts free-form law labels as `identifier` values even though the runtime lookup only supports stable corpus identifiers. A request such as `Real Decreto Legislativo 8/2015` plus `article_number: "38 ter"` should return a structured law/article mismatch path with suggestions, not a host safety block or a dead-end error.

The expected user path should find `Ley 20/2007`, Article 38 ter, and should avoid presenting `Real Decreto Legislativo 8/2015`, Article 38 ter, as a valid direct lookup. If `Real Decreto Legislativo 8/2015` is relevant only for related social security context such as Article 308, the app should distinguish that source relationship explicitly.

## Architecture Context

- Tool schemas live in `src/tools/schemas.ts`.
- Tool handlers live in `src/tools/handlers.ts`.
- SQLite and FTS5 search behavior lives in `src/store/database.ts`.
- MCP tool registration and tool descriptions live in `src/mcp/server.ts`.
- Shared response and error types live in `src/types/index.ts`.
- Current `search_laws` builds one strict FTS5 query from every query token, then merges it with an exact full-query title `LIKE` fallback.
- Current FTS exceptions in search/excerpt paths are swallowed into empty or fallback results, which hides query construction failures.
- Current `get_article` and `get_law_metadata` use exact `identifier` lookup only and do not suggest matching laws when the caller supplies a title, popular name, rank/year label, or wrong stable identifier.
- Existing tests cover basic Civil Code fixtures but do not cover `Ley 20/2007`, Article 38 ter, the reported long Spanish queries, synonym recall, or law/article mismatch recovery.
- Existing MCP tests require tools to remain read-only and model-only, without UI resources.

## Retrieval Strategy Constraint

The application must remain a lightweight source-retrieval layer. It should not introduce vector search, embeddings, semantic indexing services, external rerankers, or other heavy retrieval infrastructure for this bug fix. The server should provide clean, bounded, well-cited candidate laws, articles, snippets, and structured errors. ChatGPT should perform the expensive language understanding, relevance judgment, and user-specific explanation from those returned sources.

Implementation should prefer:

- SQLite FTS5 and ordinary SQL indexes.
- Corpus metadata, titles, article numbers, headings, and source citations.
- Cheap deterministic normalization for accents, casing, punctuation, and known aliases.
- Small bounded candidate sets with enough source text for the model to judge relevance.

Implementation should avoid:

- Embedding generation or storage.
- Vector databases or approximate nearest-neighbor indexes.
- Model calls inside the MCP server.
- Large custom ranking pipelines that are hard to explain or operate.

## Structure

- [01-reproduce-and-corpus-coverage.md](./01-reproduce-and-corpus-coverage.md) - Reproduce the reported failures and add deterministic corpus coverage for the relevant laws and articles.
- [02-search-recall-and-ranking.md](./02-search-recall-and-ranking.md) - Improve keyword search recall, normalization, synonym expansion, ranking, and failure visibility.
- [03-identifier-resolution-and-errors.md](./03-identifier-resolution-and-errors.md) - Add deterministic law label resolution and structured suggestions for unknown or mismatched article lookups.
- [04-regression-gates-and-release.md](./04-regression-gates-and-release.md) - Add end-to-end regression gates, documentation updates, and release checks.

## Assumptions

- V1 remains keyword search only; semantic embeddings are out of scope for this fix.
- The fix should preserve the current five-tool public surface unless implementation proves a new public resolver tool is necessary.
- Suggestions should be built from existing corpus metadata and indexed article content, not from model memory.
- The server cannot fully control ChatGPT host safety filters, but it can reduce unsafe-looking failed calls by improving tool descriptions, validation, structured errors, and the intended search-before-direct-lookup path.
- The corpus source is still `legalize-dev/legalize-es`, and fixture additions must preserve source identifiers, titles, citations, and URLs.
- The model using the tools is responsible for semantic interpretation. The server is responsible for fast source lookup, bounded packaging, and citation integrity.

## Confidence

**Score**: 0.91

## Global Checklist

> Mark completed items as `[x]`.

- [ ] Reproduce both reported empty search queries against the current test database or a targeted fixture database.
- [ ] Confirm whether the active corpus contains `Ley 20/2007`, Article 38 ter, and `Real Decreto Legislativo 8/2015`, Article 308.
- [ ] Add targeted fixtures or corpus smoke tests for the expected laws and article numbers.
- [ ] Make long Spanish legal queries retrieve the expected `Ley 20/2007` result within the configured limit.
- [ ] Preserve precise, source-grounded snippets and stable citation fields in every successful result.
- [ ] Return structured `unknown_law` or `unknown_article` errors with suggestions for free-form law labels and mismatched article numbers.
- [ ] Keep tool schemas bounded and reject invalid inputs without guessing.
- [ ] Update tool descriptions and contract docs so models use `search_laws` to resolve natural-language law names before `get_article`.
- [ ] Add golden prompt regressions for the bug report queries.
- [ ] Run `pnpm build` and `pnpm test` from a clean integrated state.
- [ ] Commit each implementation phase as a separate atomic change.

## Acceptance Criteria

- A search for `cuota reducida autonomos segundo año rendimientos netos inferiores salario mínimo interprofesional artículo 38 ter LGSS` with jurisdiction `es` returns `Ley 20/2007` or its stable corpus identifier in the top results when the relevant corpus record is present.
- A search for `tarifa plana cuota reducida trabajadores autónomos segundo periodo rendimientos económicos netos salario mínimo interprofesional` with jurisdiction `es` returns the same relevant law family in the top results when the relevant corpus record is present.
- A direct request for `get_article` with a non-stable identifier such as `Real Decreto Legislativo 8/2015` returns a structured error that includes candidate stable identifiers when candidates exist.
- A direct request for a valid law with a missing article returns `unknown_article` and includes nearby or relevant article suggestions when available.
- The app does not fabricate a law/article match when the supplied law and article number belong to different legal instruments.
- Search failures caused by invalid FTS query construction are visible in tests and logs instead of being silently converted to empty results.
- MCP tool metadata remains read-only and does not expose UI resources.

## Validation

- `pnpm build`
- `pnpm test`
- Targeted test run for tool handlers, database search, golden prompts, and MCP server behavior after each phase that touches those areas.
- Manual local tool calls for the two reported search queries and the reported mismatched `get_article` request.

## Risks / Notes

- If the upstream corpus does not contain the expected law/article content, implementation must distinguish missing corpus coverage from search failure.
- FTS5 ranking changes can affect unrelated search order. Add focused assertions for presence and rank bands instead of brittle full ordering assertions.
- Synonym expansion should stay narrow and auditable. Do not add broad legal-advice heuristics or hidden domain reasoning.
- Error suggestions must be clearly labeled as candidates and must never imply that a mismatched article belongs to the wrong law.
