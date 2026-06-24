# Legalize ChatGPT App Master Plan

## Goal

Build an open-source ChatGPT App that helps users understand Spanish legislation through source-grounded legal research from `legalize-dev/legalize-es`. The app should help users find relevant laws, inspect concrete articles, connect norms to their situation, and verify every answer against current sources. It must not present itself as legal advice. The app must be public, read-only by default, MIT-licensed for its own code, and careful not to publish server access details or production secrets.

## Architecture Context

- `legalize-dev/legalize-es` is a public GitHub repository containing Spanish legislation as Markdown files grouped by jurisdiction folders such as `es` and `es-*`.
- `legalize-dev/legalize-es` is part of `legalize-dev/legalize`, whose README describes legislative content as public domain and repository structure, metadata, and tooling as MIT-licensed.
- Each law file includes YAML frontmatter with identifiers, titles, publication dates, update dates, status, source URLs, and BOE references. Some fields, including ELI URLs and affected-article markers, are optional and must be modeled as nullable.
- Reform history is represented through Git commits and commit messages tied to affected laws and articles.
- OpenAI Apps SDK apps connect to ChatGPT through an MCP server. The MCP server defines tools, optional server instructions, auth, structured responses, and optional UI templates.
- The planned app is read-only. It should not mutate upstream data, user data, or legal text.
- Product purpose is defined in [../../product/product-definition.md](../../product/product-definition.md).

## Structure

- [01-project-foundation.md](./01-project-foundation.md) - Project setup, license, governance, repository hygiene, and public documentation.
- [02-corpus-ingestion-indexing.md](./02-corpus-ingestion-indexing.md) - Legal corpus ingestion, metadata parsing, article chunking, indexing, and sync strategy.
- [03-tool-contracts-api.md](./03-tool-contracts-api.md) - Tool surface, REST/internal API boundaries, schemas, citations, and error behavior.
- [04-mcp-server.md](./04-mcp-server.md) - Self-hosted MCP server, Apps SDK integration, tool registration, and local ChatGPT testing.
- [05-chatgpt-ui.md](./05-chatgpt-ui.md) - Post-MVP iframe UI backlog for search results, article reading, reform history, and comparison views.
- [06-self-hosted-deployment-security.md](./06-self-hosted-deployment-security.md) - Production deployment, secret handling, endpoint exposure, monitoring, and abuse controls.
- [07-open-source-launch.md](./07-open-source-launch.md) - Community readiness, legal disclaimers, release workflow, review process, and public launch.
- [08-handoff-contract.md](./08-handoff-contract.md) - Final no-open-questions implementation contract.

## Handoff Decisions

- User-facing app name: **Spanish Law Research**.
- Repository and package name: `legalize-chatgpt-app`.
- First release scope: anonymous, public, read-only, tools-only ChatGPT app.
- Out of scope for v1: iframe UI, user accounts, OAuth, write actions, semantic search, government submissions, and private user data storage.
- Runtime stack: TypeScript, Node.js 22 LTS, pnpm, Fastify, official MCP SDK and OpenAI Apps SDK helpers.
- Data store: SQLite with FTS5 for metadata, article chunks, reform records, and full-text search.
- Corpus sync: internal daily scheduler checks `legalize-dev/legalize-es` once per day outside request paths. When upstream changes, it uses Railway ephemeral storage for clone/build work and refreshes SQLite and FTS artifacts on the 5 GB persistent volume.
- Deployment target: Railway Hobby, one web service, one 5 GB persistent volume, Railway-managed HTTPS public domain or custom domain.
- Submission target: public ChatGPT app review using a global-data-residency OpenAI project and the public `docs/privacy.md` URL.
- External operational inputs: Railway API token, Railway project access, public domain selection, verified OpenAI publisher account, and secret values. These are deployment prerequisites, not product or architecture decisions.

## Global Instructions

- Mark completed items as `[x]`.
- Make a `git commit` after each completed phase or other meaningful atomic implementation step.
- Keep Markdown and code comments in English.
- Keep user-facing product copy polished and free from planning notes, internal reasoning, or rejected alternatives.
- Do not commit production secrets, private server access details, real `.env` files, private keys, database URLs, internal IP allowlists, or management endpoint details.
- Treat the MCP endpoint as a public application endpoint, not as public server access.
- Update this master plan when adding, removing, or reordering phases.

## Assumptions

- The initial app serves public read-only legal research workflows.
- The application code will be released under MIT.
- The upstream corpus is treated as usable based on Legalize's published MIT/public-domain statement, while this app must preserve attribution and provenance for Legalize, `legalize-es`, BOE sources, file paths, source commits, and official URLs.
- A Railway-hosted MCP server will be used for production instead of a VPS or managed database backend.
- The app will expose only the minimum public HTTPS endpoint required for ChatGPT to call the MCP tools.
- Private deployment details will be stored outside the public repository.

## Confidence

**Score**: 0.95

## Global Validation

- [ ] The repository contains a complete MIT license and open-source documentation.
- [ ] The plan covers project setup, corpus ingestion, indexing, API contracts, MCP integration, ChatGPT UI, deployment, security, and launch.
- [ ] Public documentation and generated citation metadata attribute Legalize, `legalize-es`, and official BOE sources.
- [ ] Every tool result includes stable legal identifiers, source links, and dates needed for citation.
- [ ] The implemented user experience follows the product definition and keeps answers grounded in source text rather than model memory.
- [ ] The MCP server can be tested locally before public deployment.
- [ ] Production deployment exposes only the required HTTPS app endpoint and keeps management access private.
- [ ] No public artifact contains server credentials, private endpoints, or secrets.
- [ ] The app presents legal research output with clear source citations and a non-advice disclaimer.
- [ ] `08-handoff-contract.md` contains no open product, architecture, data, UX, API, auth, or deployment decisions.

## Risks / Notes

- Apps SDK and MCP details can change. Re-check OpenAI Apps SDK documentation before implementation begins and before launch.
- Attribution and provenance must remain visible even when corpus data is cached, mirrored, indexed, or transformed for tool responses.
- Large legal texts require chunked retrieval. V1 tools must never return full megabyte-scale laws; they return search results, metadata, one bounded article, bounded excerpts, reform lists, or bounded comparisons.
- Public read-only endpoints still need rate limiting, timeouts, caching, monitoring, and abuse controls.
- Legal research output must avoid presenting itself as professional legal advice.

## Reference Sources

- OpenAI Apps SDK Quickstart: https://developers.openai.com/apps-sdk/quickstart.md
- OpenAI Apps SDK MCP server guide: https://developers.openai.com/apps-sdk/build/mcp-server.md
- OpenAI Apps SDK tool planning guide: https://developers.openai.com/apps-sdk/plan/tools.md
- OpenAI Apps SDK security and privacy guide: https://developers.openai.com/apps-sdk/guides/security-privacy.md
- Legalize overview and license statement: https://github.com/legalize-dev/legalize
- Source corpus: https://github.com/legalize-dev/legalize-es
