# Phase 01: Production Reproduction And Index State

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Reproduce the new bug report in deterministic tests and determine whether production failures are caused by current code, stale deployed code, stale corpus artifacts, or a host-level safety block before changing runtime behavior.

## Scope

- Local regression tests for the reported query and article retrieval variants.
- Production-like database inspection helpers or smoke tests.
- Clear evidence separating server behavior from OpenAI host safety behavior.
- Corpus artifact freshness checks for `BOE-A-2007-13409`, Article `38 ter`.

## Checklist

> Mark completed items as `[x]`.

- [x] Add a regression test for the exact reported `search_laws` query: `cuota reducida trabajadores autónomos segundo año rendimientos económicos netos inferiores salario mínimo interprofesional`.
- [x] Add regression tests for `get_article` with `38 ter`, `Artículo 38 ter`, `artículo 38 ter`, `38ter`, and `38 `.
- [x] Add a production smoke checklist that records active source revision, law count, article count, and whether `BOE-A-2007-13409` stores `38 ter` exactly.
- [x] Add evidence that distinguishes a server response from a host-level safety-blocked call.
- [ ] Confirm whether the production Railway data volume needs a corpus rebuild after deployment.
- [x] Commit: `git commit -m "Add tool flow reproduction coverage"`

## Validation

- [x] The new tests fail only for currently unsupported article label variants or stale-index scenarios before implementation.
- [x] The exact reported search query returns `BOE-A-2007-13409` locally when the fixture exists.
- [x] The production smoke checklist can be run without exposing secrets or private deployment details.

## Dependencies / Risks

- Production endpoint access and Railway credentials may be unavailable during implementation. Keep production checks runnable but do not block local code fixes on credentials.
- Do not write production secrets or concrete private endpoint details into the repository.
