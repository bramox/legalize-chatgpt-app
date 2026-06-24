# Phase 07: Open-Source Launch

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Prepare the project for public release, community contribution, ChatGPT app review, and responsible operation as a legal research tool.

## Scope

- Public documentation.
- Contribution and release workflow.
- App metadata and review readiness.
- Legal research disclaimers.
- Governance and maintenance.

## Checklist

> Mark completed items as `[x]`.

- [x] Add polished public README sections for purpose, features, local development, deployment overview, security boundary, and limitations.
- [x] Add a clear disclaimer that the app provides legal research support and does not provide legal advice.
- [x] Add a public privacy policy URL or document that describes read-only behavior, data minimization, retention, logging, and contact paths.
- [x] Add app metadata using app name `Spanish Law Research`, package name `legalize-chatgpt-app`, and supported jurisdictions from `docs/contracts/tools.md`.
- [x] Add golden prompt tests for search, article retrieval, reform history, comparison, ambiguous queries, and unsupported requests.
- [x] Add a release checklist covering tests, dependency audit, secret scan, docs review, and deployment smoke test.
- [x] Add contributor guidance for handling legal text fixtures, Legalize attribution, BOE source provenance, and generated index artifacts.
- [x] Add maintainership policy for issue triage, security reports, dependency updates, and index freshness.
- [ ] Use a verified OpenAI publisher profile controlled by the repository maintainer or release owner.
- [ ] Use an OpenAI project with global data residency for submission.
- [x] Use the public GitHub URL for `docs/privacy.md` as the privacy policy URL.
- [ ] Prepare ChatGPT app submission materials after the MCP endpoint, tools, privacy policy, attribution policy, screenshots, test prompts, and security posture are complete.
- [ ] Submit a concrete working MCP server URL for review and never use a placeholder URL in the submission form.
- [x] Run a full repository secret scan before making the repository public.
- [ ] Commit: `git commit -m "Prepare open-source launch materials"`

## Validation

- [x] A new contributor can understand the project goal and local setup without private deployment access.
- [x] Public docs do not include private server details.
- [x] App metadata accurately describes read-only legal research behavior.
- [x] Submission checklist includes identity verification, privacy policy URL, screenshots, test prompts and responses, and localization information.
- [x] Golden prompts pass against the production-like endpoint.
- [x] Legal disclaimer appears in appropriate public surfaces without cluttering every tool result.
- [x] The repository is safe to publish after a clean secret scan.

## Dependencies / Risks

- ChatGPT app review requirements may change. Re-check official Apps SDK documentation before submission.
- Corpus snapshots are not shipped in v1. Generated indexes remain deployment artifacts with documented attribution, provenance, freshness, backup, and storage policy.
- Security reports use GitHub private security advisories before broad public launch.
