# App Metadata

This document contains the metadata for Spanish Law Research ChatGPT app submission.

## App Information

- **App Name**: Spanish Law Research
- **Repository Name**: legalize-chatgpt-app
- **Package Name**: legalize-chatgpt-app
- **Version**: 1.0.0
- **Description**: A source-grounded assistant for understanding Spanish legislation through legal research from legalize-dev/legalize-es

## Purpose

Spanish Law Research helps users find relevant Spanish laws, inspect concrete articles, understand legal text in plain language, and verify claims against authoritative sources. The app is not a legally binding tool and does not provide legal advice. It is a research assistant that keeps users close to source material.

## Features

- Search Spanish legislation by topic, phrase, identifier, jurisdiction, status, rank, and date
- Retrieve specific laws or articles by identifier and article number
- Return short, bounded excerpts with citation metadata
- Explain source excerpts in plain language without hiding original legal text
- Identify related laws or articles when users describe situations
- Show reform history, affected articles, dates, and source links
- Compare two versions of a law or article when version data is available

## Supported Jurisdictions

- es (National/Spain)
- es-an (Andalucía)
- es-ar (Aragón)
- es-as (Asturias)
- es-cb (Canarias)
- es-cl (Cantabria)
- es-cm (Castilla-La Mancha)
- es-cn (Castilla y León)
- es-ct (Cataluña)
- es-ex (Extremadura)
- es-ga (Galicia)
- es-ib (Illes Balears)
- es-mc (Madrid)
- es-md (Melilla)
- es-nc (Navarra)
- es-pv (País Vasco)
- es-ri (La Rioja)
- es-vc (Comunidad Valenciana)

## Data Sources

- Legalize: https://github.com/legalize-dev/legalize
- Spanish corpus: https://github.com/legalize-dev/legalize-es
- BOE: https://www.boe.es/

## Tools

The app provides the following MCP tools:

1. **search_laws** - Find Spanish laws by topic, phrase, identifier, rank, status, jurisdiction, or date range
2. **get_law_metadata** - Get metadata for a specific law by identifier
3. **get_article** - Retrieve one article or bounded section by law identifier and article number
4. **get_law_excerpt** - Get a bounded excerpt about a topic inside a known law
5. **list_reforms** - List reform history for a law
6. **compare_reform** - Compare a law or article between two known revisions

## Access and Privacy

- **Access**: Anonymous, public, read-only
- **Authentication**: None required
- **User Accounts**: Not supported in v1
- **Data Collection**: No account data or private user records; operational logs are minimized and redacted
- **Data Storage**: Generated corpus indexes, metadata, article chunks, reform records, and operational logs
- **Data Retention**: Operational logs 30 days, security logs 90 days, indexes until replaced

## Legal Disclaimer

This app provides legal research support and does not provide legal advice. Users should verify information with official sources and consult qualified professionals for decisions with legal consequences.

## Privacy Policy

Privacy policy is available at: https://github.com/legalize-dev/legalize-chatgpt-app/blob/main/docs/privacy.md

## Attribution

This app attributes Legalize, legalize-es, BOE, file paths, source commits, and official source URLs in public documentation and tool outputs.

## Security

- Rate limiting: 60 requests per minute per IP
- Request size limit: 64 KB
- Response size limit: 1 MB
- No user accounts or private data storage
- No write actions or form submissions
- Public HTTPS endpoint only
- No public management endpoints

## Limitations

- V1 is tools-only (no ChatGPT iframe UI)
- Keyword search only (semantic search not supported)
- Spanish legislation only
- Read-only access
- No semantic search
- No user accounts or OAuth
- No write actions or government submissions

## Technical Details

- **Runtime**: TypeScript on Node.js 22 LTS
- **Framework**: Fastify
- **Data Store**: SQLite with FTS5
- **Deployment**: Railway Hobby
- **Protocol**: MCP over HTTPS

## Publisher Information

- **Publisher**: [To be filled by maintainer]
- **Contact**: [To be filled by maintainer]
- **Repository**: https://github.com/legalize-dev/legalize-chatgpt-app

## Open Source

This application is released under the MIT License. The Spanish corpus comes from legalize-dev/legalize-es, which describes legislative content as public domain and repository structure, metadata, and tooling as MIT-licensed.
