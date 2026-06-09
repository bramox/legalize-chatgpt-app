# Deployment Overview

Spanish Law Research is deployed as a self-hosted MCP server on Railway Hobby. This document provides a safe overview of the deployment architecture without exposing private infrastructure details.

## Architecture

- **Platform**: Railway Hobby
- **Service**: Single web service running the Fastify MCP server
- **Storage**: 5 GB persistent volume mounted at `/app/data`
- **Network**: Railway-managed HTTPS with public domain or custom domain
- **Access**: Anonymous, public, read-only access to MCP tools only

## Security Boundaries

### Public Endpoints

- The public HTTPS MCP endpoint required for ChatGPT tool calls
- Privacy policy documentation
- Attribution documentation
- Safe deployment overview (this document)

### Non-Public Operational Surfaces

- Admin panels
- Metrics dashboards
- Database ports
- Internal health endpoints
- Management interfaces

These surfaces must not be exposed by the public repository or by the public v1 application endpoint.

### Secret Management

- Production secrets are stored in Railway environment variables
- No secrets are committed to the repository
- `.railway-token` is gitignored and used only for local Railway CLI setup
- `.env.example` contains placeholder values only

## Deployment Components

### Web Service

- Runtime: Node.js 22 LTS
- Framework: Fastify
- Protocol: MCP over HTTPS
- Startup: Railway-managed health checks and process monitoring

### Persistent Volume

- Size: 5 GB
- Mount point: `/app/data`
- Contents: SQLite database, FTS indexes, sync state
- Backups: Railway volume backups
- Recovery: Rebuild from source using documented sync process

### Corpus Sync

- Scheduler: Internal daily scheduler
- Source: `legalize-dev/legalize-es` public GitHub repository
- Check method: `git ls-remote` for upstream changes
- Build location: Railway ephemeral storage
- Promotion: Atomic rename of validated artifacts to persistent volume
- Rollback: Previous active database retained on sync failure

## Rate Limiting

- Global limit: 60 requests per minute per IP
- Search limit: 20 search calls per minute per IP
- Excerpt limit: 20 excerpt calls per minute per IP
- Compare limit: 10 compare calls per minute per IP
- Request size limit: 64 KB
- Response size limit: 1 MB

## Monitoring

### Metrics Monitored

- Request latency
- Error rates
- Rate limit hits
- Failed authentication attempts
- Unusual traffic patterns
- Index freshness (last successful sync)
- Sync state consistency

### Alerts

- Sync stale alert when `last_successful_sync_at` exceeds 48 hours
- Sync divergence alert when `last_seen_remote_revision` differs from `last_indexed_revision` for more than one sync window

## Incident Response

See [incident response runbook](../runbooks/incident-response.md) for operational procedures.

## Local Development

For local development setup, see the main README.

## Production Deployment

Production deployment requires:

- Railway API token or project access
- Railway project access
- Public domain selection (Railway-managed or custom)
- Environment variable configuration
- Railway CLI or web console access

These operational inputs are deployment prerequisites and are not documented in the public repository to avoid exposing private infrastructure details.

## Safety Checks

Before deploying:

1. Run all tests and ensure they pass
2. Run linting and type checking
3. Perform secret scan on repository
4. Verify privacy policy and attribution documentation are accurate
5. Confirm no non-public operational surfaces or secrets are exposed
6. Test MCP tools against production-like environment
7. Verify rate limiting and monitoring are configured
