# Production Deploy Runbook

This runbook describes how to deploy Spanish Law Research to the Railway production service. It intentionally avoids private project IDs, management URLs, tokens, and credentials.

## Scope

Use this procedure for normal production deploys of the MCP server runtime.

Production deploys are expected to:

1. Build from the intended Git commit.
2. Upload only the public runtime files needed by the service.
3. Keep local secrets, private operator notes, generated databases, logs, and working directories out of the Railway upload.
4. Verify the public HTTPS endpoint after Railway reports success.

## Prerequisites

- Railway CLI installed and authenticated with project access.
- A gitignored `.railway-token` file or another secure local Railway authentication method.
- Access to the Railway project, production environment, and `web` service.
- Node.js, pnpm, and Git installed locally.

If `.railway-token` is used, it should contain shell-compatible environment assignments, for example:

```bash
RAILWAY_TOKEN=...
```

Use a project-scoped Railway token for deploy commands. Never print the token, commit it, or paste it into logs.

## Preflight

Run these commands from the repository root:

```bash
git status --short --branch
git log --oneline -5
railway --version
```

Load the local Railway token only for the current shell command:

```bash
set -a
. ./.railway-token
set +a
railway status
```

Confirm that Railway shows the intended project, production environment, and `web` service.

Run the full verification suite:

```bash
pnpm install --frozen-lockfile
pnpm test
```

Stop if tests fail.

## Prepare A Clean Upload Directory

Railway CLI deploys the current directory. To avoid uploading private notes, local data, build output, or development artifacts, deploy from a temporary directory containing only the runtime files.

```bash
REPO_ROOT="$(pwd)"
DEPLOY_DIR="$(mktemp -d)"

for item in \
  package.json \
  pnpm-lock.yaml \
  tsconfig.json \
  railway.json \
  railpack.json \
  LICENSE \
  README.md \
  src \
  assets
do
  cp -R "$item" "$DEPLOY_DIR/"
done

cp .gitignore "$DEPLOY_DIR/.gitignore"
find "$DEPLOY_DIR" -name .DS_Store -delete
```

Verify the upload root:

```bash
find "$DEPLOY_DIR" -maxdepth 2 -type f | sort
```

Optional sanity build from the clean upload directory:

```bash
cd "$DEPLOY_DIR"
pnpm install --frozen-lockfile
pnpm build
```

The temporary `node_modules` and `dist` directories are ignored by `.gitignore` during `railway up`.

## Deploy

From the clean upload directory:

```bash
cd "$DEPLOY_DIR"

set -a
. "$REPO_ROOT/.railway-token"
set +a

railway status

railway up \
  --service web \
  --environment production \
  --message "Production deploy $(git -C "$REPO_ROOT" rev-parse --short HEAD)"
```

Before confirming the deploy, verify that `railway status` still shows the intended project, production environment, and `web` service from the clean upload directory. Railway should return build logs and create a new deployment. Record the deployment ID from the output or from:

```bash
railway deployment list --service web --environment production --json
```

## Wait For Railway Success

Poll the service status:

```bash
railway service status --service web --environment production --json
```

Expected result:

- `status` is `SUCCESS`
- `stopped` is `false`
- `deploymentId` matches the new deployment

If the deployment is still building, wait and poll again.

If the deployment fails, inspect logs:

```bash
railway logs <deployment-id> --build --service web --environment production --lines 200
railway logs <deployment-id> --deployment --service web --environment production --lines 200
```

## Smoke Checks

Set the public origin for the deployed app:

```bash
APP_ORIGIN="https://legalize.drivingtime.pro"
```

Check service health:

```bash
curl -fsS "$APP_ORIGIN/healthz" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s); console.log(JSON.stringify({ok:j.ok, ready:j.database?.ready, laws:j.database?.lawCount, articles:j.database?.articleCount, stale:j.index?.stale, lastIndexed:j.index?.last_indexed_revision, freeBytes:j.storage?.free_bytes}, null, 2));})'
```

Expected:

- `ok: true`
- `ready: true`
- non-zero law and article counts
- storage free space above the configured threshold

Check OpenAI app verification endpoint:

```bash
curl -fsS "$APP_ORIGIN/.well-known/openai-apps-challenge"
```

Expected: the configured verification token as plain text.

Check MCP tool listing:

```bash
curl -fsS -X POST "$APP_ORIGIN/mcp" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const data=s.split(/\r?\n/).find(l=>l.startsWith("data: ")); const payload=data ? data.slice(6) : s; const j=JSON.parse(payload); console.log(JSON.stringify({toolCount:j.result?.tools?.length, tools:j.result?.tools?.map(t=>t.name)}, null, 2));})'
```

Expected tools:

- `search_laws`
- `get_law_metadata`
- `get_article`
- `get_law_excerpt`
- `list_reforms`

Check a functional search:

```bash
curl -fsS -X POST "$APP_ORIGIN/mcp" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_laws","arguments":{"query":"Estatuto de los Trabajadores artículo 56 despido improcedente","limit":3}}}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const data=s.split(/\r?\n/).find(l=>l.startsWith("data: ")); const payload=data ? data.slice(6) : s; const j=JSON.parse(payload); const content=j.result?.content?.[0]?.text; const parsed=content ? JSON.parse(content) : null; console.log(JSON.stringify({ok:!j.error, resultCount:parsed?.results?.length, first:parsed?.results?.[0]?.citation?.identifier, nextTool:parsed?.results?.[0]?.next_tool?.name ?? null}, null, 2));})'
```

Expected:

- `ok: true`
- `resultCount` greater than zero
- `nextTool` is usually `get_article` for exact article matches

## Corpus Sync Verification

The service starts with the existing persisted SQLite database from the Railway volume. On startup, the daily sync scheduler checks `legalize-dev/legalize-es` and rebuilds the corpus if the upstream revision changed.

After deploy, inspect deployment logs:

```bash
railway logs <deployment-id> --deployment --service web --environment production --filter "Corpus" --lines 200
```

Healthy startup usually includes:

- `Database connected`
- `Corpus sync started`
- `Corpus sync scheduler started`
- `Corpus remote revision resolved`

If `/healthz` reports `stale: true` but `ok: true` and `ready: true`, the service is usable while background sync runs. Continue monitoring logs until sync completes or fails.

If sync fails:

1. Keep the current deployment online if `/healthz` remains `ok: true`.
2. Review corpus logs and storage status.
3. Verify network access to the public `legalize-dev/legalize-es` repository.
4. Confirm the Railway volume has enough free space.
5. Follow the sync failure section in [Incident Response](./incident-response.md).

## Rollback Or Redeploy

If the new deployment is unhealthy, use Railway to redeploy the latest known good deployment or redeploy the previous good commit.

Useful inspection commands:

```bash
railway deployment list --service web --environment production --json
railway logs <deployment-id> --deployment --service web --environment production --lines 200
railway logs <deployment-id> --build --service web --environment production --lines 200
```

For a clean hotfix deploy:

1. Fix the issue locally.
2. Run `pnpm test`.
3. Repeat the clean upload deploy procedure.
4. Run all smoke checks again.

## Cleanup

After deploy and verification:

```bash
rm -rf "$DEPLOY_DIR"
```

Do not delete the Railway persistent volume during normal deploys. It contains the active corpus database and sync state.

## Public Evidence

When recording deployment evidence in public docs, include only safe facts:

- local commit hash
- test command result
- Railway deployment status
- public endpoint smoke-test results
- database record counts

Do not include:

- Railway API tokens
- private management URLs
- project, environment, or workspace IDs unless the repository owner has explicitly approved publication
- local absolute paths
- raw logs that may contain private operational metadata
