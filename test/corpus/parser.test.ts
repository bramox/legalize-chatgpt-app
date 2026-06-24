import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseFrontmatter,
  extractMarkdownBody,
  chunkMarkdown,
  frontmatterToLawRecord,
  validateChunk,
  validateLawRecord,
} from "../../src/corpus/parser.js";
import {
  canonicalizeArticleLabel,
  recoverCanonicalArticleNumber,
} from "../../src/lib/article-labels.js";

describe("corpus/parser", () => {
  describe("parseFrontmatter", () => {
    it("should parse valid YAML frontmatter", () => {
      const content = `---
identifier: BOE-A-1889-4763
title: Real Decreto de 24 de julio de 1889 por el que se publica el Código Civil
country: es
rank: real_decreto
publication_date: 1889-07-25
last_updated: 2025-01-03
status: in_force
source: BOE
---
Content here`;
      const frontmatter = parseFrontmatter(content, "test.md");

      assert.strictEqual(frontmatter.identifier, "BOE-A-1889-4763");
      assert.strictEqual(frontmatter.title, "Real Decreto de 24 de julio de 1889 por el que se publica el Código Civil");
      assert.strictEqual(frontmatter.country, "es");
      assert.strictEqual(frontmatter.status, "in_force");
      assert.strictEqual(frontmatter.last_updated, "2025-01-03");
    });

    it("should throw on missing frontmatter", () => {
      assert.throws(
        () => parseFrontmatter("No frontmatter here", "test.md"),
        /No YAML frontmatter found/,
      );
    });

    it("should throw on missing required field", () => {
      const content = `---
title: Test Law
country: es
last_updated: 2025-01-01
status: in_force
---
Content here`;
      assert.throws(
        () => parseFrontmatter(content, "test.md"),
        /Missing required field/,
      );
    });

    it("should handle nullable optional fields", () => {
      const content = `---
identifier: TEST-001
title: Test Law
country: es
last_updated: 2025-01-01
status: in_force
---
Content here`;
      const frontmatter = parseFrontmatter(content, "test.md");
      assert.strictEqual(frontmatter.rank, undefined);
      assert.strictEqual(frontmatter.publication_date, undefined);
    });
  });

  describe("extractMarkdownBody", () => {
    it("should extract body after frontmatter", () => {
      const content = `---
identifier: TEST
title: Test
country: es
last_updated: 2025-01-01
status: in_force
---
# TÍTULO PRELIMINAR

## CAPÍTULO I

### Artículo 1

Texto del artículo.`;
      const body = extractMarkdownBody(content);

      assert.ok(body.startsWith("# TÍTULO PRELIMINAR"));
      assert.ok(body.includes("Artículo 1"));
      assert.ok(!body.includes("identifier:"));
    });

    it("should return entire content if no frontmatter", () => {
      const content = "# Title\n\nContent";
      const body = extractMarkdownBody(content);
      assert.strictEqual(body, content);
    });
  });

  describe("chunkMarkdown", () => {
    it("should chunk markdown into article records", () => {
      const markdown = `# TÍTULO PRELIMINAR

## CAPÍTULO I

### Artículo 1

Texto del artículo uno.

### Artículo 2

Texto del artículo dos.`;
      const chunks = chunkMarkdown(
        markdown,
        "BOE-A-1889-4763",
        "es",
        "abc123",
        "es/BOE-A-1889-4763.md",
      );

      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].article_number, "1");
      assert.strictEqual(chunks[1].article_number, "2");
      assert.ok(chunks[0].text.includes("Texto del artículo uno"));
      assert.ok(chunks[1].text.includes("Texto del artículo dos"));
    });

    it("should capture heading paths", () => {
      const markdown = `# TÍTULO PRELIMINAR

## CAPÍTULO I

### Artículo 1

Texto del artículo.`;
      const chunks = chunkMarkdown(
        markdown,
        "BOE-A-1889-4763",
        "es",
        "abc123",
        "es/BOE-A-1889-4763.md",
      );

      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].article_number, "1");
      assert.ok(Array.isArray(chunks[0].heading_path));
      assert.ok(chunks[0].heading_path.length > 0);
    });

    it("should handle Spanish article characters", () => {
      const markdown = `
# TÍTULO I

## CAPÍTULO I

### Artículo 1º

Texto del artículo.

### Artículo 2ª

Texto del segundo artículo.
`;
      const chunks = chunkMarkdown(
        markdown,
        "TEST-001",
        "es",
        "abc123",
        "es/TEST-001.md",
      );

      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].article_number, "1º");
      assert.strictEqual(chunks[1].article_number, "2ª");
      assert.ok(chunks[0].text.includes("Texto del artículo"));
      assert.ok(chunks[1].text.includes("Texto del segundo artículo"));
    });

    it("should handle article without heading markers", () => {
      const markdown = `# TÍTULO I

Artículo 1

Texto del artículo.

Artículo 2

Texto del segundo artículo.`;
      const chunks = chunkMarkdown(
        markdown,
        "TEST-002",
        "es",
        "abc123",
        "es/TEST-002.md",
      );

      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].article_number, "1");
      assert.strictEqual(chunks[1].article_number, "2");
    });

    it("should handle artículo único", () => {
      const markdown = `# TÍTULO I

Artículo único

Texto del artículo único.`;
      const chunks = chunkMarkdown(
        markdown,
        "TEST-003",
        "es",
        "abc123",
        "es/TEST-003.md",
      );

      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].article_number, "único");
      assert.ok(chunks[0].text.includes("Texto del artículo único"));
    });

    it("should handle spelled Spanish ordinal article headings", () => {
      const markdown = `# Ley 49/1960

###### Artículo noveno.

1. Son obligaciones de cada propietario:

a) Respetar las instalaciones generales de la comunidad.

###### Artículo décimo.

Texto del artículo siguiente.`;
      const chunks = chunkMarkdown(
        markdown,
        "BOE-A-1960-10906",
        "es",
        "abc123",
        "es/BOE-A-1960-10906.md",
      );

      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].article_number, "9");
      assert.strictEqual(chunks[1].article_number, "10");
      assert.ok(chunks[0].text.includes("obligaciones de cada propietario"));
    });

    it("should handle artículo with bis", () => {
      const markdown = `# TÍTULO I

Artículo 10 bis

Texto del artículo bis.`;
      const chunks = chunkMarkdown(
        markdown,
        "TEST-004",
        "es",
        "abc123",
        "es/TEST-004.md",
      );

      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].article_number, "10 bis");
      assert.ok(chunks[0].text.includes("Texto del artículo bis"));
    });

    it("should handle artículo with ter", () => {
      const markdown = `# TÍTULO I

Artículo 38 ter

Texto del artículo ter.`;
      const chunks = chunkMarkdown(
        markdown,
        "TEST-004b",
        "es",
        "abc123",
        "es/TEST-004b.md",
      );

      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].article_number, "38 ter");
      assert.ok(chunks[0].text.includes("Texto del artículo ter"));
    });

    it("should handle artículo with quater", () => {
      const markdown = `# TÍTULO I

Artículo 5 quater

Texto del artículo quater.`;
      const chunks = chunkMarkdown(
        markdown,
        "TEST-004c",
        "es",
        "abc123",
        "es/TEST-004c.md",
      );

      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].article_number, "5 quater");
      assert.ok(chunks[0].text.includes("Texto del artículo quater"));
    });

    it("should handle artículo with decies", () => {
      const markdown = `# TÍTULO I

Artículo 5 decies

Texto del artículo decies.`;
      const chunks = chunkMarkdown(
        markdown,
        "TEST-004d",
        "es",
        "abc123",
        "es/TEST-004d.md",
      );

      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].article_number, "5 decies");
      assert.ok(chunks[0].text.includes("Texto del artículo decies"));
    });

    it("should handle article with heading marker", () => {
      const markdown = `# TÍTULO I

### Artículo 1

Texto del artículo.`;
      const chunks = chunkMarkdown(
        markdown,
        "TEST-005",
        "es",
        "abc123",
        "es/TEST-005.md",
      );

      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].article_number, "1");
      assert.ok(chunks[0].text.includes("Texto del artículo"));
    });

    it("should handle both accented and unaccented 'Articulo'", () => {
      const markdown = `# TÍTULO I

### Articulo 1

Texto del artículo sin acento.

### Artículo 2

Texto del artículo con acento.`;
      const chunks = chunkMarkdown(
        markdown,
        "TEST-006",
        "es",
        "abc123",
        "es/TEST-006.md",
      );

      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].article_number, "1");
      assert.strictEqual(chunks[1].article_number, "2");
      assert.ok(chunks[0].text.includes("sin acento"));
      assert.ok(chunks[1].text.includes("con acento"));
    });

    it("should skip empty article chunks", () => {
      const markdown = `# TÍTULO I

### Artículo 1

Texto del primer artículo.

### Artículo 2



### Artículo 3

Texto del tercer artículo.`;
      const chunks = chunkMarkdown(
        markdown,
        "TEST-007",
        "es",
        "abc123",
        "es/TEST-007.md",
      );

      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].article_number, "1");
      assert.strictEqual(chunks[1].article_number, "3");
      assert.strictEqual(chunks[0].chunk_index, 0);
      assert.strictEqual(chunks[1].chunk_index, 1);
    });

    it("should handle skipped heading levels without sibling inheritance", () => {
      const markdown = `## TÍTULO I

###### Artículo 36

Texto del artículo treinta y seis.

###### Artículo 37

Texto del artículo treinta y siete.`;
      const chunks = chunkMarkdown(
        markdown,
        "TEST-008",
        "es",
        "abc123",
        "es/TEST-008.md",
      );

      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].article_number, "36");
      assert.strictEqual(chunks[1].article_number, "37");

      assert.deepStrictEqual(chunks[0].heading_path, ["TÍTULO I", "Artículo 36"]);
      assert.deepStrictEqual(chunks[1].heading_path, ["TÍTULO I", "Artículo 37"]);
    });
  });

  describe("frontmatterToLawRecord", () => {
    it("should convert frontmatter to law record with URLs", () => {
      const content = `---
identifier: BOE-A-1889-4763
title: Real Decreto de 24 de julio de 1889 por el que se publica el Código Civil
country: es
rank: real_decreto
publication_date: 1889-07-25
last_updated: 2025-01-03
status: in_force
source: BOE
url_eli: https://www.boe.es/eli/es/rd/1889/07/24/(1)
---
Content`;
      const frontmatter = parseFrontmatter(content, "test.md");
      const record = frontmatterToLawRecord(
        frontmatter,
        "es/BOE-A-1889-4763.md",
        "abc123",
        "es",
      );

      assert.strictEqual(record.identifier, "BOE-A-1889-4763");
      assert.strictEqual(record.jurisdiction, "es");
      assert.ok(record.github_url.includes("abc123"));
      assert.ok(record.raw_url.includes("abc123"));
      assert.ok(record.boe_url); // BOE URL should be generated from identifier
      assert.strictEqual(record.eli_url, frontmatter.url_eli);
    });

    it("should handle nullable fields", () => {
      const content = `---
identifier: TEST-001
title: Test Law
country: es
last_updated: 2025-01-01
status: in_force
---
Content`;
      const frontmatter = parseFrontmatter(content, "test.md");
      const record = frontmatterToLawRecord(
        frontmatter,
        "es/TEST-001.md",
        "abc123",
        "es",
      );

      assert.strictEqual(record.rank, null);
      assert.strictEqual(record.publication_date, null);
      assert.strictEqual(record.boe_url, null); // No BOE format
    });
  });

  describe("validateChunk", () => {
    it("should pass validation for valid chunk", () => {
      const markdown = `# TÍTULO PRELIMINAR

## CAPÍTULO I

### Artículo 1

Texto del artículo.`;
      const chunks = chunkMarkdown(
        markdown,
        "BOE-A-1889-4763",
        "es",
        "abc123",
        "es/BOE-A-1889-4763.md",
      );

      assert.strictEqual(chunks.length, 1);
      assert.doesNotThrow(() => validateChunk(chunks[0]));
    });

    it("should throw on empty chunk", () => {
      const chunk = {
        law_identifier: "TEST",
        jurisdiction: "es",
        article_number: "1",
        heading_path: [],
        text: "",
        source_revision: "abc",
        legalize_path: "test.md",
        chunk_index: 0,
      };

      assert.throws(() => validateChunk(chunk), /Empty chunk/);
    });

    it("should throw on oversized chunk", () => {
      const chunk = {
        law_identifier: "TEST",
        jurisdiction: "es",
        article_number: "1",
        heading_path: [],
        text: "x".repeat(200_000),
        source_revision: "abc",
        legalize_path: "test.md",
        chunk_index: 0,
      };

      assert.throws(() => validateChunk(chunk), /Chunk too large/);
    });
  });

  describe("validateLawRecord", () => {
    it("should pass validation for valid record", () => {
      const content = `---
identifier: BOE-A-1889-4763
title: Real Decreto de 24 de julio de 1889 por el que se publica el Código Civil
country: es
rank: real_decreto
publication_date: 1889-07-25
last_updated: 2025-01-03
status: in_force
source: BOE
---
Content`;
      const frontmatter = parseFrontmatter(content, "test.md");
      const record = frontmatterToLawRecord(
        frontmatter,
        "es/BOE-A-1889-4763.md",
        "abc123",
        "es",
      );

      assert.doesNotThrow(() => validateLawRecord(record));
    });

    it("should throw on missing identifier", () => {
      const record = {
        identifier: "",
        title: "Test",
        jurisdiction: "es",
        status: "in_force",
        rank: null,
        publication_date: null,
        last_updated: "2025-01-01",
        source_revision: "abc",
        legalize_path: "test.md",
        github_url: "http://example.com",
        raw_url: "http://example.com/raw",
        boe_url: null,
        eli_url: null,
        url_html_consolidada: null,
        url_pdf: null,
        department: null,
        subjects: null,
        consolidation_status: null,
        scope: null,
        frontmatter: {},
      };

      assert.throws(() => validateLawRecord(record), /missing identifier/);
    });

    it("should throw on invalid date format", () => {
      const content = `---
identifier: BOE-A-1889-4763
title: Real Decreto de 24 de julio de 1889 por el que se publica el Código Civil
country: es
rank: real_decreto
publication_date: 1889-07-25
last_updated: 2025-01-03
status: in_force
source: BOE
---
Content`;
      const frontmatter = parseFrontmatter(content, "test.md");
      const record = frontmatterToLawRecord(
        frontmatter,
        "es/BOE-A-1889-4763.md",
        "abc123",
        "es",
      );
      record.last_updated = "invalid-date";

      assert.throws(() => validateLawRecord(record), /Invalid last_updated format/);
    });
  });

  describe("article label canonicalization", () => {
    it("should canonicalize '38 ter' to '38 ter'", () => {
      const result = canonicalizeArticleLabel("38 ter");
      assert.strictEqual(result, "38 ter");
    });

    it("should canonicalize 'Artículo 38 ter' to '38 ter'", () => {
      const result = canonicalizeArticleLabel("Artículo 38 ter");
      assert.strictEqual(result, "38 ter");
    });

    it("should canonicalize 'artículo 38 ter' to '38 ter'", () => {
      const result = canonicalizeArticleLabel("artículo 38 ter");
      assert.strictEqual(result, "38 ter");
    });

    it("should canonicalize 'art. 38 ter' to '38 ter'", () => {
      const result = canonicalizeArticleLabel("art. 38 ter");
      assert.strictEqual(result, "38 ter");
    });

    it("should canonicalize '38ter' to '38 ter'", () => {
      const result = canonicalizeArticleLabel("38ter");
      assert.strictEqual(result, "38 ter");
    });

    it("should canonicalize '10 bis' to '10 bis'", () => {
      const result = canonicalizeArticleLabel("10 bis");
      assert.strictEqual(result, "10 bis");
    });

    it("should canonicalize 'Artículo 10 bis' to '10 bis'", () => {
      const result = canonicalizeArticleLabel("Artículo 10 bis");
      assert.strictEqual(result, "10 bis");
    });

    it("should canonicalize '10bis' to '10 bis'", () => {
      const result = canonicalizeArticleLabel("10bis");
      assert.strictEqual(result, "10 bis");
    });

    it("should handle 'único' articles", () => {
      const result = canonicalizeArticleLabel("Artículo único");
      assert.strictEqual(result, "único");
    });

    it("should handle 'Articulo 1' (without accent)", () => {
      const result = canonicalizeArticleLabel("Articulo 1");
      assert.strictEqual(result, "1");
    });

    it("should handle '1º' (ordinal)", () => {
      const result = canonicalizeArticleLabel("1º");
      assert.strictEqual(result, "1º");
    });

    it("should handle '2ª' (ordinal feminine)", () => {
      const result = canonicalizeArticleLabel("2ª");
      assert.strictEqual(result, "2ª");
    });

    it("should handle 'Artículo 1º' with ordinal", () => {
      const result = canonicalizeArticleLabel("Artículo 1º");
      assert.strictEqual(result, "1º");
    });

    it("should handle spelled Spanish ordinal article labels", () => {
      assert.strictEqual(canonicalizeArticleLabel("Artículo primero"), "1");
      assert.strictEqual(canonicalizeArticleLabel("Artículo noveno."), "9");
      assert.strictEqual(canonicalizeArticleLabel("Artículo décimo"), "10");
    });

    it("should handle whitespace variations", () => {
      const result1 = canonicalizeArticleLabel("  38  ter  ");
      assert.strictEqual(result1, "38 ter");
    });

    it("should return null for invalid labels", () => {
      const result = canonicalizeArticleLabel("invalid");
      assert.strictEqual(result, null);
    });

    it("should return null for empty string", () => {
      const result = canonicalizeArticleLabel("");
      assert.strictEqual(result, null);
    });

    it("should handle 'decies' suffix", () => {
      const result = canonicalizeArticleLabel("Artículo 5 decies");
      assert.strictEqual(result, "5 decies");
    });

    it("should handle '5decies' (compact)", () => {
      const result = canonicalizeArticleLabel("5decies");
      assert.strictEqual(result, "5 decies");
    });
  });

  describe("article label recovery", () => {
    it("should recover canonical '38 ter' from legacy '38 '", () => {
      const result = recoverCanonicalArticleNumber("38 ", "38 ter");
      assert.strictEqual(result, "38 ter");
    });

    it("should return null when stored value is already canonical", () => {
      const result = recoverCanonicalArticleNumber("38 ter", "38 ter");
      assert.strictEqual(result, "38 ter");
    });

    it("should return null for mismatched values", () => {
      const result = recoverCanonicalArticleNumber("37", "38 ter");
      assert.strictEqual(result, null);
    });

    it("should return null for empty inputs", () => {
      const result = recoverCanonicalArticleNumber("", "38 ter");
      assert.strictEqual(result, null);
    });

    it("should not recover across different base numbers", () => {
      const result = recoverCanonicalArticleNumber("37 ", "38 ter");
      assert.strictEqual(result, null);
    });

    it("should not recover '38 ter' from plain '38' without trailing space (negative regression)", () => {
      // This is the key safety fix: a plain "38" (without trailing space) should NOT be
      // recovered as "38 ter" because it could be a legitimate Article 38
      const result = recoverCanonicalArticleNumber("38", "38 ter");
      assert.strictEqual(result, null, "Plain '38' without trailing space should not recover to '38 ter'");
    });
  });
});
