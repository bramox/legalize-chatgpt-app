# Phase 05: Production Release Verification

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Deploy the hardened tool flow and verify that production serves fresh code and corpus artifacts for the reported autónomo workflow.

## Scope

- Final local validation.
- Railway deployment.
- Corpus rebuild or compatibility verification.
- Public MCP smoke tests.
- Post-deploy evidence.

## Checklist

> Mark completed items as `[x]`.

- [x] Run `pnpm build`.
- [x] Run `pnpm test`.
- [ ] Verify Railway credentials and project access without committing secrets.
- [ ] Deploy the current branch to Railway using the repository's existing deployment configuration.
- [ ] Confirm `/healthz` is healthy on the public application endpoint.
- [ ] Verify the active production corpus has `BOE-A-2007-13409` and Article `38 ter` in canonical form, or confirm compatibility lookup handles the active index.
- [ ] Run production MCP smoke tests for the reported `search_laws` query and `get_article` variants.
- [x] Record public-safe deployment evidence under the relevant proof artifact or release checklist without exposing private tokens, project IDs, or management URLs.
- [ ] Commit: `git commit -m "Record production tool flow verification"`

## Validation

- [ ] Production `search_laws` returns `BOE-A-2007-13409` for the reported query.
- [ ] Production `get_article` returns full Article `38 ter` for canonical and natural article labels.
- [ ] Production no longer returns malformed suggestion article numbers such as `38 ` for the target article.
- [ ] Production MCP endpoint remains read-only and rate-limited.

## Dependencies / Risks

- Railway deployment is blocked without valid credentials or project access.
- If production corpus rebuild is slow or fails, compatibility lookup should still prevent the broken user flow while rebuild is investigated.
