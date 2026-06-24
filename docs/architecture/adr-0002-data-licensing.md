# ADR 0002: Data Licensing, Attribution, And Provenance

## Status

Accepted.

## Decision

This app uses `legalize-dev/legalize-es` as the Spanish legislation corpus. `legalize-dev/legalize` describes legislative content as public domain because it is sourced from official government publications, and describes repository structure, metadata, and tooling as MIT-licensed.

The app must attribute:

- Legalize.
- `legalize-dev/legalize`.
- `legalize-dev/legalize-es`.
- BOE and any official source URL present in corpus metadata.

Every successful tool response must preserve source provenance through identifiers, source commit, Legalize file path, GitHub source URL, BOE URL when present, and last update date.

## Rules

- Do not commit the upstream corpus clone to this repository.
- Do not commit generated SQLite databases, FTS indexes, or sync artifacts.
- Keep public fixtures small and source-attributed.
- Treat optional fields such as `url_eli`, `url_html_consolidada`, affected-article markers, and reform references as nullable.
- Never present this app as an official BOE service, a public authority, a lawyer, or a source of legal advice.

## Consequences

Generated indexes may be deployed privately as runtime artifacts when they preserve attribution and provenance. Public documentation must keep attribution visible without exposing private infrastructure details.
