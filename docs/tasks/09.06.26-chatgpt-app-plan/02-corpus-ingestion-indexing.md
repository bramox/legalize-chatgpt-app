# Phase 02: Corpus Ingestion And Indexing

Back to master plan: [00-master-plan.md](./00-master-plan.md)

## Objective

Build a reliable read-only ingestion pipeline for `legalize-dev/legalize-es` that extracts metadata, article-level chunks, source links, and reform history without requiring the ChatGPT tool layer to clone or parse the full repository on every request and without exceeding the Railway Hobby 5 GB persistent volume budget.

## Scope

- Source synchronization through an ephemeral sync workspace.
- Daily upstream update detection.
- YAML frontmatter parsing.
- Markdown article and section chunking.
- Search index schema.
- Reform history extraction from local Git commits.
- Data freshness and integrity checks.

## Checklist

> Mark completed items as `[x]`.

- [x] Store only active SQLite/FTS artifacts, sync state, and small manifests on the Railway persistent volume.
- [x] Do not store a persistent git clone, raw corpus checkout, staged build tree, or local backup copy on the Railway persistent volume.
- [x] Add an internal daily sync scheduler inside the Railway web service process; do not use a separate Railway cron service because it cannot share the same volume with the web service.
- [x] In each daily sync run, use `git ls-remote https://github.com/legalize-dev/legalize-es.git HEAD` to read the remote revision.
- [x] Compare the last indexed source revision with the remote revision; exit successfully without database writes when no new commit is available.
- [x] When a new commit is available, clone or fetch `legalize-dev/legalize-es` inside a temporary Railway ephemeral sync workspace.
- [x] Build updated SQLite and FTS artifacts in the ephemeral sync workspace.
- [x] Run integrity checks against the staged artifacts before making them active.
- [x] Copy validated final artifacts to `*.next` files on the persistent volume, then atomically rename them into active paths.
- [x] Keep serving the previous active database when daily sync fails.
- [x] Never clone, fetch, or parse the corpus inside tool request handlers.
- [x] Store normalized metadata, article chunks, and reform records in SQLite with FTS5.
- [x] Use an external-content FTS5 design so full article text is not duplicated inside the FTS table.
- [ ] Keep active SQLite and FTS artifacts under 2.2 GB total so active plus `*.next` promotion files fit within the 5 GB volume.
- [ ] Run a corpus shape audit across national and autonomous-community files to classify required, optional, nullable, and deprecated frontmatter fields.
- [x] Implement metadata extraction for required fields such as `identifier`, `title`, `country`, `rank`, `publication_date`, `last_updated`, `status`, and `source`.
- [x] Implement optional metadata extraction for fields such as `url_eli`, `url_html_consolidada`, `url_pdf`, BOE page ranges, subjects, and reform reference fields without treating absent values as ingestion failures.
- [x] Implement Markdown parsing into stable chunks keyed by law identifier, jurisdiction, heading path, article number, and source commit.
- [x] Preserve exact source links to Legalize overview, `legalize-es` file paths, GitHub raw/blob URLs, source commits, and BOE URLs where available.
- [x] Create a normalized metadata store for law records and a full-text search index for articles and sections.
- [x] Do not implement semantic search in v1.
- [x] Extract reform history for each law from local Git commit metadata and affected article markers where available.
- [x] Add sync idempotency so repeated syncs do not duplicate records.
- [ ] Add integrity checks for missing identifiers, malformed frontmatter, unexpectedly huge chunks, and broken source URLs.
- [x] Store sync state with `last_checked_at`, `last_successful_sync_at`, `last_indexed_revision`, `last_seen_remote_revision`, law count, chunk count, reform count, skipped count, and error count.
- [x] Expose index freshness in internal health output without leaking private filesystem paths.
- [x] Commit: `git commit -m "Add corpus ingestion and indexing pipeline"`

## Validation

- [x] Ingestion succeeds on a small fixture containing one national law and one regional law.
- [ ] Corpus audit output documents required and nullable metadata fields before schema implementation is considered complete.
- [ ] Ingestion succeeds on a representative production subset without loading entire megabyte-scale files into tool responses.
- [x] Search returns relevant results with identifiers, titles, jurisdiction, status, update date, and source links.
- [x] Article retrieval returns only the requested article or bounded context.
- [ ] Sync logs include counts for laws, chunks, skipped records, errors, and source revision.
- [x] Running the daily sync job twice against the same upstream revision performs no database promotion on the second run.
- [x] A failed staged sync leaves the previous active database readable by all tool handlers.
- [x] Internal health output reports index freshness and last indexed revision.
- [x] Runtime health output reports persistent volume free space and fails readiness when free space falls below 512 MB.

## Dependencies / Risks

- Do not commit the corpus clone, generated SQLite databases, FTS indexes, or sync artifacts to this repository.
- Do not keep the corpus clone on the Railway persistent volume.
- GitHub API rate limits must not affect normal tool requests because v1 uses SQLite indexes at runtime and checks upstream changes outside request paths.
- Markdown article headings may vary across laws. Parsing should fail fast on malformed input and report the affected file.
