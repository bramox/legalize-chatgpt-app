# Tool Contracts

## Scope

These are the complete v1 MCP tool contracts for `Spanish Law Research`.

All tools are:

- Anonymous.
- Public.
- Read-only.
- Non-destructive.
- Source-grounded.
- Limited to Spanish legislation from `legalize-dev/legalize-es`.

V1 supports keyword search only. Semantic search is out of scope.

## Shared Limits

- Default result limit: `10`.
- Maximum result limit: `20` for search and `50` for reform history.
- Maximum request body size: `64 KB`.
- Maximum MCP response size: `1 MB`.
- Maximum text returned by one article or comparison call: `30000` characters.
- Maximum text returned by one excerpt call: `12000` characters.

## Supported Jurisdictions

`es`, `es-an`, `es-ar`, `es-as`, `es-cb`, `es-cl`, `es-cm`, `es-cn`, `es-ct`, `es-ex`, `es-ga`, `es-ib`, `es-mc`, `es-md`, `es-nc`, `es-pv`, `es-ri`, `es-vc`.

## Shared Citation

When an output schema references `Shared Citation`, embed this object shape.

```json
{
  "identifier": "BOE-A-1889-4763",
  "title": "Real Decreto de 24 de julio de 1889 por el que se publica el Código Civil",
  "jurisdiction": "es",
  "status": "in_force",
  "rank": "real_decreto",
  "publication_date": "1889-07-25",
  "last_updated": "2025-01-03",
  "source_revision": "git commit sha",
  "legalize_path": "es/BOE-A-1889-4763.md",
  "github_url": "https://github.com/legalize-dev/legalize-es/blob/<sha>/es/BOE-A-1889-4763.md",
  "raw_url": "https://raw.githubusercontent.com/legalize-dev/legalize-es/<sha>/es/BOE-A-1889-4763.md",
  "boe_url": "https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763",
  "eli_url": "https://www.boe.es/eli/es/rd/1889/07/24/(1)"
}
```

`boe_url`, `eli_url`, `rank`, and `publication_date` are nullable when the corpus does not provide them.

## Shared Error

```json
{
  "ok": false,
  "error": {
    "code": "unknown_law",
    "message": "No law was found for the supplied identifier.",
    "details": {
      "identifier": "BOE-A-0000-0000"
    }
  }
}
```

Allowed error codes:

- `invalid_input`
- `unsupported_jurisdiction`
- `unknown_law`
- `unknown_article`
- `ambiguous_query`
- `source_unavailable`
- `limit_exceeded`

## search_laws

Use this when the user asks to find Spanish laws by topic, phrase, identifier, rank, status, jurisdiction, or date range.

Input schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["query"],
  "properties": {
    "query": { "type": "string", "minLength": 2, "maxLength": 300 },
    "jurisdiction": {
      "type": "string",
      "enum": ["es", "es-an", "es-ar", "es-as", "es-cb", "es-cl", "es-cm", "es-cn", "es-ct", "es-ex", "es-ga", "es-ib", "es-mc", "es-md", "es-nc", "es-pv", "es-ri", "es-vc"]
    },
    "status": { "type": "string" },
    "rank": { "type": "string" },
    "date_from": { "type": "string", "format": "date" },
    "date_to": { "type": "string", "format": "date" },
    "limit": { "type": "integer", "minimum": 1, "maximum": 20, "default": 10 },
    "cursor": { "type": "string" }
  }
}
```

Output schema:

```json
{
  "ok": true,
  "results": [
    {
      "citation": "Shared Citation",
      "snippet": "Short matched excerpt.",
      "score": 12.34,
      "matched_fields": ["title", "body"]
    }
  ],
  "next_cursor": null
}
```

## get_law_metadata

Use this when the user provides a stable law identifier and needs metadata without article text.

Input schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["identifier"],
  "properties": {
    "identifier": { "type": "string", "minLength": 3, "maxLength": 80 },
    "jurisdiction": {
      "type": "string",
      "enum": ["es", "es-an", "es-ar", "es-as", "es-cb", "es-cl", "es-cm", "es-cn", "es-ct", "es-ex", "es-ga", "es-ib", "es-mc", "es-md", "es-nc", "es-pv", "es-ri", "es-vc"]
    }
  }
}
```

Output schema:

```json
{
  "ok": true,
  "citation": "Shared Citation",
  "metadata": {
    "department": "Ministerio de Gracia y Justicia",
    "subjects": ["Código Civil"],
    "consolidation_status": "Finalizado",
    "scope": "Estatal",
    "frontmatter": {}
  }
}
```

## get_article

Use this when the user asks for one article or bounded section by law identifier and article number.

Input schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["identifier", "article_number"],
  "properties": {
    "identifier": { "type": "string", "minLength": 3, "maxLength": 80 },
    "article_number": { "type": "string", "minLength": 1, "maxLength": 40 },
    "jurisdiction": {
      "type": "string",
      "enum": ["es", "es-an", "es-ar", "es-as", "es-cb", "es-cl", "es-cm", "es-cn", "es-ct", "es-ex", "es-ga", "es-ib", "es-mc", "es-md", "es-nc", "es-pv", "es-ri", "es-vc"]
    },
    "max_chars": { "type": "integer", "minimum": 1000, "maximum": 30000, "default": 12000 }
  }
}
```

Output schema:

```json
{
  "ok": true,
  "citation": "Shared Citation",
  "article": {
    "article_number": "1",
    "heading_path": ["TÍTULO PRELIMINAR", "CAPÍTULO I"],
    "text": "Article text.",
    "truncated": false
  }
}
```

If the requested article exceeds `max_chars`, return truncated text with `truncated: true` and do not exceed the response limit.

## get_law_excerpt

Use this when the user asks for a bounded excerpt about a topic inside a known law.

Input schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["identifier", "query"],
  "properties": {
    "identifier": { "type": "string", "minLength": 3, "maxLength": 80 },
    "query": { "type": "string", "minLength": 2, "maxLength": 300 },
    "jurisdiction": {
      "type": "string",
      "enum": ["es", "es-an", "es-ar", "es-as", "es-cb", "es-cl", "es-cm", "es-cn", "es-ct", "es-ex", "es-ga", "es-ib", "es-mc", "es-md", "es-nc", "es-pv", "es-ri", "es-vc"]
    },
    "max_chars": { "type": "integer", "minimum": 1000, "maximum": 12000, "default": 6000 }
  }
}
```

Output schema:

```json
{
  "ok": true,
  "citation": "Shared Citation",
  "excerpts": [
    {
      "heading_path": ["TÍTULO PRELIMINAR"],
      "article_number": "1",
      "text": "Matched bounded excerpt.",
      "score": 8.5
    }
  ]
}
```

## list_reforms

Use this when the user asks how a law has changed over time.

Input schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["identifier"],
  "properties": {
    "identifier": { "type": "string", "minLength": 3, "maxLength": 80 },
    "jurisdiction": {
      "type": "string",
      "enum": ["es", "es-an", "es-ar", "es-as", "es-cb", "es-cl", "es-cm", "es-cn", "es-ct", "es-ex", "es-ga", "es-ib", "es-mc", "es-md", "es-nc", "es-pv", "es-ri", "es-vc"]
    },
    "date_from": { "type": "string", "format": "date" },
    "date_to": { "type": "string", "format": "date" },
    "limit": { "type": "integer", "minimum": 1, "maximum": 50, "default": 20 },
    "cursor": { "type": "string" }
  }
}
```

Output schema:

```json
{
  "ok": true,
  "citation": "Shared Citation",
  "reforms": [
    {
      "commit_sha": "git commit sha",
      "date": "2026-06-09",
      "source_id": "BOE-A-2026-12427",
      "disposition_id": "BOE-A-2026-12427",
      "affected_articles": null,
      "summary": "Short reform summary.",
      "github_commit_url": "https://github.com/legalize-dev/legalize-es/commit/<sha>",
      "source_url": "https://www.boe.es/..."
    }
  ],
  "next_cursor": null
}
```

`affected_articles` is nullable when the commit says `N/A` or the corpus does not provide article markers.
