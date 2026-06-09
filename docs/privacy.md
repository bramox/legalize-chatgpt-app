# Privacy Policy

## Scope

Spanish Law Research is a read-only legal research app for Spanish legislation from `legalize-dev/legalize-es`.

## Data Processed

The app processes:

- User prompts sent by ChatGPT to select and call read-only tools.
- Tool inputs such as search terms, law identifiers, article numbers, date filters, and jurisdiction filters.
- Public legal source data from Legalize, `legalize-es`, BOE, and linked official sources.

The app does not require user accounts and does not intentionally collect names, addresses, identity documents, case files, legal filings, payment data, or government account credentials.

## Storage

The app stores generated corpus indexes, metadata, article chunks, reform records, operational logs, and security logs.

Logs may contain request metadata, correlation IDs, tool names, validation errors, latency, and rate-limit events. Logs must not store raw prompts.

## Retention

- Operational logs: 30 days.
- Security logs: 90 days.
- Generated corpus indexes: until replaced by a newer successful sync.
- Railway volume backups: retention configured in Railway. Application-created local backup copies are not stored on the 5 GB persistent volume.

## Sharing

The app does not sell user data. Public legal source data may be returned to ChatGPT as tool output. Operational logs remain on the self-hosted infrastructure and are not published in the open-source repository.

## User Guidance

Users should avoid entering sensitive personal facts. The app provides legal research support and does not provide legal advice.

## Contact

Security and privacy issues must be reported through GitHub private security advisories in the public repository.
