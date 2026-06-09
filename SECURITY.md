# Security Policy

## Scope

This repository is planned as an open-source ChatGPT App codebase. Security reports should cover application code, MCP tool behavior, indexing code, deployment templates, and documentation that could lead to unsafe deployment.

## Secrets Policy

Do not commit secrets. This includes API keys, tokens, SSH keys, private server addresses, production host credentials, database URLs, webhook secrets, or complete `.env` files.

Use `.env.example` files with placeholder values only. Production secrets must be stored in Railway environment variables. Local deployment setup may use `.railway-token`, which is ignored by git and must never be committed.

## Server Exposure Policy

The self-hosted MCP server requires a public HTTPS endpoint so ChatGPT can call app tools. That endpoint must expose only the application API required for MCP operation. SSH, admin panels, metrics dashboards, database ports, and internal management endpoints must remain private.

## Reporting

Report security issues through GitHub private security advisories in the public repository. Do not file public issues for vulnerabilities, secrets, private infrastructure details, or abuse paths.
