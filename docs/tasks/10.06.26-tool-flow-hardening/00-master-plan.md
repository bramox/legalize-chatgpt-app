# Spanish Law Research Tool Flow Hardening Master Plan

## Goal

Make Spanish Law Research reliable for the intended ChatGPT workflow: search by a natural-language legal question, identify the correct law and article, retrieve the full article text with a stable citation, and guide the model toward the next correct tool call without relying on brittle manual inference or tool rediscovery workarounds.

## Bug Report Conclusion

The new report shows that the previous fixes reduced search-recall failures but did not fully close the user-facing workflow. The remaining problems are:

- A benign `search_laws` call can still be blocked before it reaches the server. The server cannot fully control OpenAI host safety checks, but tool descriptions, server instructions, query shaping guidance, and submission test cases should make the intended safe flow clearer.
- The model found the right law after rediscovering tool definitions, which means the tool manifest and instructions are not explicit enough about the direct path for Russian natural-language legal questions.
- `get_article` still behaves as an exact string lookup. In a fresh local index, `38 ter` works, but natural labels such as `Artículo 38 ter`, `artículo 38 ter`, `38ter`, and legacy malformed values such as `38 ` still fail and only return suggestions.
- Production may have stale corpus artifacts built with the older parser. If the active database stores `38 ` instead of `38 ter`, deploying code alone will not fix production until the corpus is rebuilt or compatibility lookup is added.
- `search_laws` returns snippets but does not provide structured article-level routing hints. GPT has to infer the next `get_article` call from text snippets, which is fragile when article labels include suffixes.

## Architecture Context

- MCP tool registration and server instructions live in `src/mcp/server.ts`.
- Tool input/output schemas live in `src/tools/schemas.ts`.
- Tool handlers live in `src/tools/handlers.ts`.
- Article parsing and article-number extraction live in `src/corpus/parser.ts`.
- SQLite search, exact article lookup, and article suggestions live in `src/store/database.ts`.
- Tool contracts live in `docs/contracts/tools.md`.
- Golden prompt and MCP behavior tests live in `test/golden/prompts.test.ts`, `test/mcp/server.test.ts`, `test/tools/handlers.test.ts`, and `test/store/database.test.ts`.
- Deployment target is Railway with active SQLite/FTS artifacts under the persistent data volume.

## Retrieval Strategy Constraint

Keep the app as a lightweight source-retrieval layer. Do not add embeddings, vector search, semantic indexes, external rerankers, or server-side model calls. Use deterministic normalization, SQLite/FTS5, bounded SQL helpers, and structured response fields that help ChatGPT choose the next tool call.

## Structure

- [01-production-reproduction-and-index-state.md](./01-production-reproduction-and-index-state.md) - Reproduce the reported flow and distinguish code defects from stale production index state.
- [02-article-label-canonicalization.md](./02-article-label-canonicalization.md) - Canonicalize article labels and add compatibility lookup for Spanish suffix variants.
- [03-search-routing-hints.md](./03-search-routing-hints.md) - Add bounded article-level hints to search results so GPT knows which `get_article` call to make next.
- [04-tool-guidance-and-safety.md](./04-tool-guidance-and-safety.md) - Harden server instructions, tool descriptions, and golden prompts for the intended search-to-article workflow.
- [05-production-release-verification.md](./05-production-release-verification.md) - Rebuild or validate production corpus artifacts, deploy, and run production smoke tests.

## Global Instructions

- Mark completed items as `[x]`.
- Make a `git commit` after each completed phase or other meaningful atomic implementation step.
- Update this master plan when adding, removing, or reordering phases.
- Keep Markdown and code comments in English.
- Do not add heavy retrieval infrastructure or server-side model calls.

## Assumptions

- The public tool surface should remain the existing five read-only tools unless implementation proves a hard blocker.
- The expected flow is `search_laws` first, then `get_article` using a stable law identifier and a canonical article number returned or hinted by the search result.
- Production may still be running stale code or stale SQLite artifacts until Railway deploy and corpus rebuild are verified.
- Host-level OpenAI safety checks cannot be guaranteed by repository code, but the app can make safe tool calls shorter, more canonical, and easier for GPT to select.

## Confidence

**Score**: 0.88

## Global Validation

- [x] `pnpm build` passes.
- [x] `pnpm test` passes.
- [x] `get_article` succeeds for `38 ter`, `Artículo 38 ter`, `artículo 38 ter`, and `38ter`.
- [x] Spanish suffix regression coverage includes `bis`, `ter`, `quater`, `quinquies`, `sexies`, `septies`, `octies`, `nonies`, and `decies`.
- [x] `get_article` either resolves or gives an explicit compatibility path for legacy malformed stored article numbers such as `38 `.
- [x] `search_laws` returns `BOE-A-2007-13409` for the reported benign query and includes bounded article-level routing hints for Article `38 ter`.
- [x] MCP tests confirm five read-only tools and no UI resource exposure.
- [x] Golden prompts cover the Russian user question and the expected `search_laws` then `get_article` sequence.
- [ ] Production smoke tests pass against the public Railway MCP endpoint after deploy and corpus rebuild or compatibility verification.

## Risks / Notes

- Host safety blocks are outside the MCP server's direct control. The implementation can reduce false positives but cannot promise that every possible benign phrase will pass host checks.
- If production artifacts were built with the old parser, a corpus rebuild or compatibility lookup is required; code deploy alone may not change stored article numbers.
- Adding article-level hints changes the search output contract. Keep the fields optional and bounded to preserve backward compatibility.
- Tool guidance must stay concise and public-facing. Do not add internal reasoning, debugging notes, or hidden workflow commentary to user-facing text.
