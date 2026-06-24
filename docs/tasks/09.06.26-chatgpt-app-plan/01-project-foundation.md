# Phase 01: Project Foundation

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Create a clean open-source project foundation that is safe to publish, clearly MIT-licensed for application code, and explicit about secret handling, source attribution, and upstream corpus provenance.

## Scope

- Repository hygiene and public documentation.
- License, security policy, contribution policy, attribution policy, and issue templates.
- Initial architecture decision records for stack, hosting, data strategy, and app boundaries.
- No runtime implementation in this phase.

## Checklist

> Mark completed items as `[x]`.

- [x] Use repository and package name `legalize-chatgpt-app`.
- [x] Use user-facing app name `Spanish Law Research`.
- [x] Keep `LICENSE` as MIT for this application's code and documentation.
- [x] Add `CONTRIBUTING.md` with contribution workflow, review expectations, and language standards.
- [x] Add `CODE_OF_CONDUCT.md` using a standard open-source template.
- [x] Add issue templates for bugs, feature requests, security-sensitive reports, and documentation updates.
- [x] Keep `docs/architecture/adr-0001-stack.md` as the accepted stack decision for implementation.
- [x] Keep `docs/architecture/adr-0002-data-licensing.md` as the accepted licensing, attribution, and provenance decision.
- [x] Keep `docs/attribution.md` as the public attribution policy for Legalize, `legalize-es`, BOE, and any other official sources used by fixtures or generated indexes.
- [x] Add `.env.example` with placeholder-only values and comments that forbid real secrets.
- [x] Keep `docs/privacy.md` as the public privacy policy describing read-only behavior, data minimization, retention, logging, and contact paths.
- [x] Add a private deployment inventory note to the runbook structure without real hosts, IPs, credentials, or management URLs.
- [x] Commit: `git commit -m "Set up open-source project foundation"`

## Validation

- [x] `git status --short` shows only expected files before commit.
- [x] A repository secret scan finds no real secrets.
- [x] Documentation states that MIT covers this app code and that Legalize describes legislative content as public domain while requiring clear attribution and provenance.
- [x] Documentation states that public MCP access is limited to the required application endpoint.
- [x] Public attribution and privacy documents contain no private deployment details.

## Dependencies / Risks

- The public name is fixed as `Spanish Law Research` for v1.
- Attribution and provenance must be preserved before the app vendors, mirrors, indexes, or republishes transformed corpus data.
