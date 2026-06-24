# ADR 0001: V1 Stack

## Status

Accepted.

## Decision

V1 uses:

- TypeScript on Node.js 22 LTS.
- pnpm for package management.
- Fastify for HTTP routing.
- Official TypeScript MCP SDK and OpenAI Apps SDK helper patterns for MCP/App integration.
- SQLite with FTS5 for metadata, article chunks, reform history, and keyword search.
- Railway Hobby as the v1 hosting target.
- One Railway web service with one 5 GB persistent volume mounted for runtime database artifacts.
- An internal daily sync scheduler inside the web service process.
- A temporary Railway ephemeral sync workspace for corpus clone, parsing, and staged database builds.
- Railway public HTTPS domain or custom domain for the MCP endpoint.
- Anonymous public read-only tool access.

V1 does not include:

- ChatGPT iframe UI.
- Semantic search.
- User accounts.
- OAuth.
- Write actions.
- Government submission workflows.
- Private user data storage.

## Rationale

This stack keeps the first release small, inspectable, self-hosted, and aligned with the read-only corpus workflow. SQLite FTS5 is enough for the initial Spanish corpus and avoids adding a separate search service. Railway Hobby provides a 5 GB volume, which is enough when the persistent volume stores only active SQLite/FTS artifacts, sync state, and small manifests. Full corpus clone, parsing output, and staged builds belong in ephemeral storage.

## Consequences

- Tool handlers read from SQLite indexes only.
- The web service owns both MCP requests and the internal daily sync scheduler because the v1 Railway volume is mounted to that service.
- The internal sync scheduler owns Git operations and corpus parsing.
- Sync jobs build database artifacts in ephemeral staging and copy only validated final artifacts onto the persistent volume.
- The persistent volume stores no full git clone, no raw corpus checkout, and no local backup copies.
- Generated databases, indexes, corpus clones, and sync artifacts stay outside the public repository.
- A future UI or semantic search release requires a separate plan.
