# Phase 06: Self-Hosted Deployment And Security

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Deploy the MCP server on Railway Hobby while exposing only the public HTTPS application endpoint required by ChatGPT and keeping all operational secrets out of the repository.

## Scope

- Production hosting architecture: Railway Hobby web service with one 5 GB persistent volume.
- Railway-managed HTTPS public domain or custom domain.
- Railway project and token handling policy.
- Secret management.
- Monitoring, rate limiting, volume budget controls, and incident response.
- Public documentation that is safe for an open-source repository.

## Checklist

> Mark completed items as `[x]`.

- [x] Use Railway Hobby as the only v1 hosting target.
- [ ] Deploy one Railway web service for the Fastify MCP server.
- [ ] Attach one 5 GB Railway persistent volume mounted at `/app/data`.
- [ ] Use Railway-managed HTTPS through the default public Railway domain or a custom domain.
- [ ] Expose only the public HTTPS MCP/app endpoint needed by ChatGPT.
- [ ] Verify the public MCP endpoint is reachable over HTTPS from OpenAI review and testing flows without exposing private management routes.
- [x] Do not add SSH, Caddy, Docker Compose, or VPS runbooks for v1.
- [x] Keep database files, search index files, metrics, and internal health output private.
- [x] Store production secrets in Railway environment variables, never in the repository.
- [x] Add `.env.example` with placeholders only.
- [x] Keep `.railway-token` gitignored and use it only for local Railway CLI/API setup.
- [x] Publish only safe privacy, security, and deployment overview documentation; keep concrete hostnames for SSH, metrics, databases, and management tools private.
- [x] Add a global rate limit of 60 requests per minute per IP.
- [x] Add stricter limits of 20 search or excerpt calls per minute per IP and 10 compare calls per minute per IP.
- [x] Add a 64 KB request body limit and a 1 MB MCP response limit.
- [x] Add server-side timeouts: 10 seconds for SQLite/search calls, 30 seconds for sync network calls, and 60 seconds for full sync subprocess steps.
- [x] Add caching for common searches, metadata reads, and article reads.
- [ ] Add monitoring for latency, errors, rate limit hits, failed auth, unusual traffic, and index freshness.
- [ ] Alert when `last_successful_sync_at` is older than 48 hours or when `last_seen_remote_revision` differs from `last_indexed_revision` for more than one successful sync window.
- [x] Use Railway volume backups for recovery and document rebuild-from-source as the primary restore path for generated indexes.
- [x] Do not store application-created local backup copies on the 5 GB persistent volume.
- [x] Add an incident response runbook that omits private credentials and exact management endpoints.
- [x] Commit: `git commit -m "Document self-hosted deployment and security controls"`

## Validation

- [ ] Public scan shows only the intended Railway HTTPS app endpoint.
- [x] Database files, metrics, and internal health endpoints are not publicly reachable.
- [ ] Railway-managed HTTPS certificate is valid.
- [x] MCP endpoint returns healthy responses without exposing internal version banners or stack traces.
- [ ] Public routes expose only the MCP/app surface, privacy policy, attribution, and safe documentation required for review.
- [x] Logs redact tokens, prompts where not needed, and personal data.
- [ ] A fresh deploy can be completed using public docs plus Railway environment variables and `.railway-token` kept outside git.

## Dependencies / Risks

- A public MCP endpoint can still be abused even when read-only. The fixed v1 rate limits, caching, and monitoring are required for production.
- Publishing Railway tokens, project IDs, environment IDs, or private Railway URLs would create avoidable operational risk. Keep these details in private operational storage.
- User accounts, OAuth, private data, and write actions are out of scope for v1 and require a separate security review.
