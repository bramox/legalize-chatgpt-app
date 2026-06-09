# Spanish Law Research

A source-grounded ChatGPT App that helps users understand Spanish legislation through legal research from [`legalize-dev/legalize-es`](https://github.com/legalize-dev/legalize-es), not model memory.

## Purpose

Spanish Law Research helps users find relevant laws, inspect concrete articles, understand legal text in plain language, and verify every claim against authoritative sources. The app is not a legally binding tool and does not provide legal advice. It is a research assistant that keeps users close to source material.

**Legal Disclaimer**: This app provides legal research support and does not provide legal advice. Users should verify information with official sources and consult qualified professionals for decisions with legal consequences.

## Features

- Search Spanish legislation by topic, phrase, identifier, jurisdiction, status, rank, and date
- Retrieve specific laws or articles by identifier and article number
- Return short, bounded excerpts with citation metadata
- Explain source excerpts in plain language without hiding original legal text
- Identify related laws or articles when users describe situations
- Show reform history, affected articles, dates, and source links

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

Legalize describes legislative content as public domain and its repository structure, metadata, and tooling as MIT-licensed. This app attributes Legalize, `legalize-es`, and BOE sources in all public documentation and tool outputs.

## License

This application is released under the MIT License. The MIT License covers this application's source code and documentation. See [LICENSE](./LICENSE) for details.

## Getting Started

### Prerequisites

- Node.js 22 LTS
- pnpm
- Git

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/bramox/legalize-chatgpt-app.git
cd legalize-chatgpt-app
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment example:
```bash
cp .env.example .env
```

4. Configure environment variables (see `.env.example` for available options)

5. Build the project:
```bash
pnpm build
```

6. Run tests:
```bash
pnpm test
```

7. Start the development server:
```bash
pnpm dev
```

### MCP Tools

The app provides the following MCP tools:

- **search_laws** - Find Spanish laws by topic, phrase, identifier, rank, status, jurisdiction, or date range
- **get_law_metadata** - Get metadata for a specific law by identifier
- **get_article** - Retrieve one article or bounded section by law identifier and article number
- **get_law_excerpt** - Get a bounded excerpt about a topic inside a known law
- **list_reforms** - List reform history for a law

See [Tool Contracts](./docs/contracts/tools.md) for detailed API documentation.

## Deployment

### Overview

Spanish Law Research is deployed as a self-hosted MCP server on Railway Hobby. The deployment includes:

- Single web service running the Fastify MCP server
- 5 GB persistent volume for database and indexes
- Railway-managed HTTPS with public domain
- Anonymous, public, read-only access

See [Deployment Overview](./docs/deployment/overview.md) for detailed deployment documentation.

### Security

- Rate limiting: 60 requests per minute per IP
- Request size limit: 64 KB
- Response size limit: 1 MB
- No user accounts or private data storage
- No write actions or form submissions
- Public HTTPS endpoint only
- No public management endpoints

See [Security Policy](./SECURITY.md) for security details.

## Documentation

- [Product Definition](./docs/product/product-definition.md) - Product purpose and principles
- [Tool Contracts](./docs/contracts/tools.md) - MCP tool API documentation
- [Deployment Overview](./docs/deployment/overview.md) - Deployment architecture and procedures
- [Incident Response](./docs/runbooks/incident-response.md) - Operational runbook
- [Release Checklist](./docs/release/checklist.md) - Release procedures
- [Maintainership Policy](./docs/release/maintainership.md) - Maintainer responsibilities
- [App Metadata](./docs/release/app-metadata.md) - ChatGPT app submission details
- [Attribution Policy](./docs/attribution.md) - Source attribution requirements
- [Privacy Policy](./docs/privacy.md) - Privacy and data handling
- [Terms of Service](./docs/terms.md) - Terms for using the app

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Code of Conduct

This project adheres to a Code of Conduct. Please see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for details.

## Security

For security concerns, please see [Security Policy](./SECURITY.md). Report security issues through GitHub private security advisories.

## Limitations

- V1 is tools-only (no ChatGPT iframe UI)
- Keyword search only (semantic search not supported)
- Spanish legislation only
- Read-only access
- No user accounts or OAuth
- No write actions or government submissions

## Current Status

This repository contains public documentation and runtime code for Spanish Law Research. Production deployment and ChatGPT app submission require final verification, a concrete HTTPS MCP endpoint, and maintainer-provided operational credentials.

## Security Boundary

The public repository must never contain:

- SSH credentials, private keys, access tokens, or server passwords
- Real `.env` files
- Private infrastructure diagrams that expose management hosts or admin paths
- Database connection strings or internal IP allowlists
- Railway project IDs, environment IDs, or private management URLs

Only safe examples, placeholders, and deployment runbook structure belong in the open-source repository. Production secrets are stored in Railway environment variables.
