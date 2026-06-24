# Phase 04: MCP Server

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Implement the self-hosted MCP server that exposes the app's read-only tools to ChatGPT and keeps model-facing contracts separate from corpus indexing internals.

## Scope

- MCP server setup.
- Apps SDK-compatible tool registration.
- Structured tool responses.
- Local development and ChatGPT developer-mode testing.
- No production deployment secrets in the repository.

## Checklist

> Mark completed items as `[x]`.

- [x] Implement the MCP server in TypeScript on Node.js 22 LTS.
- [x] Set up the MCP server using the official TypeScript MCP SDK and OpenAI Apps SDK helper patterns.
- [x] Add concise server instructions that explain the app is read-only and must cite sources.
- [x] Register the read-only tools from Phase 03 with explicit input and output schemas from `docs/contracts/tools.md`.
- [x] Add `_meta.ui.resourceUri` only for render tools that should display a UI component, and keep data tools JSON-only.
- [x] Keep data-processing tools separate from render tools when a workflow needs both model-readable data and UI rendering.
- [x] Make tool handlers idempotent because ChatGPT may retry calls.
- [x] Add request validation, timeouts, correlation IDs, and structured logging with PII redaction.
- [x] Keep v1 anonymous and public; do not implement OAuth, account linking, sessions, user profiles, or private-data tools.
- [x] Add local tests for each tool handler using small corpus fixtures.
- [x] Add integration tests for MCP initialization, tool listing, valid calls, invalid calls, and bounded response size.
- [x] Commit: `git commit -m "Implement self-hosted MCP server tools"`

## Validation

- [x] MCP server starts locally and exposes all planned tools.
- [x] Tool list metadata matches `docs/contracts/tools.md` descriptions and passes the golden prompt routing tests.
- [x] Invalid requests fail fast with structured errors.
- [x] Tool responses include citations and do not leak environment variables or internal paths.
- [ ] Local ChatGPT developer-mode testing can call the server through a temporary HTTPS development tunnel without committing tunnel URLs.

## Dependencies / Risks

- ChatGPT requires the MCP server to be reachable over HTTPS for app testing, review, and production use.
- Development tunnels are temporary operational details and must not be committed.
- Authentication, OAuth, private data, and account linking are out of scope for v1 and require a separate plan.
