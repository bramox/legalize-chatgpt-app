# Phase 08: Handoff Contract

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Verdict

This plan is ready for implementation without further product, business-logic, architecture, API, auth, UI, corpus, or deployment decisions.

## Fixed Scope

- Build `Spanish Law Research`, an anonymous, public, read-only ChatGPT app for source-grounded Spanish legal research.
- Use `legalize-dev/legalize-es` as the Spanish legislation corpus.
- Attribute Legalize, `legalize-es`, BOE, file paths, source commits, and official source URLs in public docs and tool outputs.
- Ship v1 as tools-only. Do not build an iframe UI in v1.
- Do not implement semantic search, user accounts, OAuth, write actions, government submissions, or private user data storage in v1.

## Fixed Technical Decisions

- Language/runtime: TypeScript on Node.js 22 LTS.
- Package manager: pnpm.
- HTTP server: Fastify.
- MCP integration: official TypeScript MCP SDK and OpenAI Apps SDK helper patterns.
- Data store: SQLite with FTS5.
- Corpus sync: internal daily scheduler checks `legalize-dev/legalize-es` with `git ls-remote` and uses Railway ephemeral storage for clone/build work only when upstream changed.
- Database refresh: when daily sync sees a new upstream revision, build SQLite and FTS artifacts in ephemeral staging, run integrity checks, copy validated `*.next` artifacts to the 5 GB Railway volume, atomically rename them into active paths, and keep the previous active database on failure.
- Runtime retrieval path: SQLite only. Tool handlers must not clone, fetch, or parse the full corpus during requests.
- Deployment: Railway Hobby, one web service, one 5 GB persistent volume mounted at `/app/data`, Railway-managed HTTPS.
- Auth: anonymous public read-only access only.
- Public docs: README, privacy policy, security policy, attribution policy, and safe deployment overview.

## Fixed Tool Surface

Implement exactly these MCP tools from [../../contracts/tools.md](../../contracts/tools.md):

- `search_laws`
- `get_law_metadata`
- `get_article`
- `get_law_excerpt`
- `list_reforms`
- `compare_reform`

All tools are read-only, anonymous, and return structured content with source citations.

## External Inputs

The implementer must not ask product questions. The only external inputs are operational credentials and endpoints:

- Railway API token.
- Railway project access.
- Public Railway domain or custom domain for the MCP endpoint.
- Secret values for production environment variables.
- Verified OpenAI publisher profile and global-data-residency OpenAI project for app submission.

These inputs do not change product behavior, tool contracts, data modeling, auth mode, UI scope, deployment architecture, or launch criteria.

## Stop Conditions

Stop implementation only for one of these reasons:

- Legalize or BOE source availability changes in a way that prevents corpus access.
- Official OpenAI Apps SDK or MCP requirements change and contradict the accepted contracts.
- The deployment operator cannot provide the required Railway token, project access, or domain.
- A secret, private endpoint, or unsafe infrastructure detail is discovered in a public artifact.

## Completion Criteria

- All phase checklists from 01 through 07 are complete or explicitly marked out of scope for v1.
- `docs/contracts/tools.md` matches implemented MCP schemas.
- Golden prompts pass against the production-like HTTPS MCP endpoint.
- Public docs contain privacy, attribution, security, non-advice disclaimer, and safe deployment information.
- Secret scan, tests, lint, build, and deployment smoke test pass.
- ChatGPT developer-mode testing succeeds over HTTPS.
