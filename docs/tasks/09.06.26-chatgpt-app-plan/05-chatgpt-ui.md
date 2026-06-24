# Phase 05: Post-MVP ChatGPT UI

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Record the post-MVP iframe UI backlog without blocking the v1 tools-only release. Do not implement a ChatGPT iframe UI in v1.

## Scope

- No v1 runtime implementation.
- UI requirements captured for a future v1.1 plan.
- MCP tool responses must remain useful without UI components.

## V1 Decision

- V1 ships as an anonymous, read-only, tools-only ChatGPT app.
- No v1 tool registers `_meta.ui.resourceUri`.
- No v1 app resource, widget bundle, iframe, subframe, or UI bridge code is implemented.
- UI work starts only after the v1 MCP tools, production deployment, privacy policy, attribution policy, and golden prompt tests are complete.

## Future UI Requirements

> These requirements are not part of the v1 implementation checklist.

- Create one component template for search and article-reading workflows.
- Create a separate comparison component only when the combined component becomes difficult to maintain.
- Render law title, identifier, status, jurisdiction, last update date, source links, and article text.
- Render reform history as a timeline with reform date, source law, affected articles, and GitHub commit link.
- Render comparisons with clear before/after sections and affected article labels.
- Use the MCP Apps UI bridge for portable host communication.
- Register UI resources with stable template URIs, `_meta.ui.domain`, strict `_meta.ui.csp`, and optional widget descriptions.
- Declare strict widget CSP metadata and only allow required connect, resource, and image domains.
- Do not use subframes.
- Version UI template URIs when markup or bundle changes in a breaking way.
- Add accessibility checks for keyboard navigation, focus states, headings, and source links.

## V1 Validation

- [x] No v1 tool descriptor includes `_meta.ui.resourceUri`.
- [x] All golden prompts pass using structured tool responses only.
- [x] Public launch and ChatGPT submission materials do not promise an iframe UI.
- [x] Future UI requirements remain documented without creating runtime coupling.

## Dependencies / Risks

- Adding UI before stable contracts increases review, CSP, and maintenance work. The first release deliberately avoids that risk.
