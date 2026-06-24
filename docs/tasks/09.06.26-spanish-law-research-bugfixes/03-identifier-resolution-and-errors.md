# Phase 03: Identifier Resolution And Errors

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Make direct lookup tools fail helpfully and deterministically when callers provide a title, common law label, or mismatched law/article pair instead of a stable corpus identifier.

## Scope

- Internal law label resolution for handler recovery.
- Structured suggestion details for `unknown_law` and `unknown_article`.
- Tool schema and description tightening.
- Contract documentation updates.
- Tests for mismatched law/article lookup behavior.

## Checklist

> Mark completed items as `[x]`.

- [ ] Add an internal resolver that can find candidate laws by stable identifier, title, rank/year label, BOE-style labels, and common normalized title fragments.
- [ ] Keep exact stable identifier lookup as the primary fast path.
- [ ] When a non-stable identifier label has candidates, return `unknown_law` with `details.candidates` instead of treating the label as a valid identifier.
- [ ] When a law exists but the article number does not, return `unknown_article` with nearby article numbers and relevant article candidates when available.
- [ ] Ensure the `Real Decreto Legislativo 8/2015` plus `38 ter` path does not fabricate a successful Article 38 ter response.
- [ ] Update `get_article` and `get_law_metadata` descriptions to say stable identifiers are required and natural-language law names should be resolved with `search_laws` first.
- [ ] Update `docs/contracts/tools.md` if error details gain candidate fields.
- [ ] Add handler and MCP tests for candidate-bearing structured errors.
- [ ] Commit: `git commit -m "Add structured law lookup suggestions"`

## Validation

- `get_article` with `identifier: "Real Decreto Legislativo 8/2015"` and `article_number: "38 ter"` returns a structured error with candidate information when matching law metadata exists.
- `get_article` with the stable identifier for the law containing Article 38 ter succeeds.
- `get_article` with the stable identifier for `Real Decreto Legislativo 8/2015` and an unavailable Article 38 ter returns `unknown_article`.
- Existing business-error MCP behavior still sets `isError: true` and returns structured content.
- Tool descriptions remain concise and do not add user-facing legal advice.

## Dependencies / Risks

- Candidate details should include only stable identifiers, titles, jurisdiction, status, dates, and source links already allowed by the citation contract.
- Candidate suggestions must be bounded to avoid response-size problems.
- Tightening identifier validation too aggressively could reject valid non-BOE identifiers from autonomous-community corpora. Prefer resolver-driven errors over a BOE-only regex unless the corpus audit proves that stricter validation is safe.
