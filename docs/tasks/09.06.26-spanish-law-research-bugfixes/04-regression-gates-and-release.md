# Phase 04: Regression Gates And Release

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Verify the integrated fix against the bug report, preserve existing MCP behavior, and prepare the change for release.

## Scope

- Golden prompt regression tests.
- MCP metadata and structured response checks.
- Documentation and submission artifact review.
- Manual local verification commands.
- Final release readiness evidence.

## Checklist

> Mark completed items as `[x]`.

- [ ] Add golden prompt tests for the two reported Russian-to-Spanish legal research scenarios.
- [ ] Add a golden prompt test that resolves a natural-language law label through search before direct article retrieval.
- [ ] Add a negative golden prompt test for the mismatched `Real Decreto Legislativo 8/2015`, Article 38 ter request.
- [ ] Re-run MCP tests that assert five read-only tools and no UI resource exposure.
- [ ] Update `chatgpt-app-submission.json` test cases if the new behavior changes recommended app-review scenarios.
- [ ] Update documentation only where public contracts or expected tool usage changed.
- [ ] Verify that the final implementation does not add embeddings, vector databases, model calls, or external reranking services.
- [ ] Run final `pnpm build`.
- [ ] Run final `pnpm test`.
- [ ] Record the exact manual local tool calls and structured outcomes in the implementation PR or release notes.
- [ ] Commit: `git commit -m "Add legal research recall regression gates"`

## Validation

- Every acceptance criterion from `00-master-plan.md` is `PASS`.
- The integrated repository passes `pnpm build` and `pnpm test`.
- The reported search queries no longer produce empty results when the relevant law exists in the indexed corpus.
- The reported mismatched direct lookup no longer produces an unhelpful dead end.
- Public docs and submission artifacts contain only polished final behavior, not debugging notes or implementation rationale.

## Dependencies / Risks

- If ChatGPT host safety behavior still blocks a malformed direct call before it reaches the server, release notes should state the server-side mitigation and the supported user path through `search_laws`.
- Do not add UI resources or iframe behavior as part of this bug fix.
