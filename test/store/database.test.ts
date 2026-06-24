import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  LawDatabase,
  openDatabase,
  createStagingDatabase,
} from "../../src/store/database.js";
import {
  parseFrontmatter,
  extractMarkdownBody,
  chunkMarkdown,
  frontmatterToLawRecord,
} from "../../src/corpus/parser.js";
import {
  recoverCanonicalArticleNumber,
} from "../../src/lib/article-labels.js";
import { createTempDir, cleanupTempDir } from "../helpers/setup.js";

describe("store/database", () => {
  let db: LawDatabase;
  let tempDir: string;

  before(async () => {
    tempDir = await createTempDir();
    const dbPath = `${tempDir}/test.db`;
    db = await openDatabase(dbPath);
  });

  after(async () => {
    db.close();
    await cleanupTempDir(tempDir);
  });

  describe("schema initialization", () => {
    it("should create all required tables", () => {
      const tables = db
        .getDb()
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);
      assert.ok(tableNames.includes("laws"));
      assert.ok(tableNames.includes("articles"));
      assert.ok(tableNames.includes("reforms"));
      assert.ok(tableNames.includes("articles_fts"));
    });

    it("should create required indexes", () => {
      const indexes = db
        .getDb()
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name",
        )
        .all() as { name: string }[];

      const indexNames = indexes.map((i) => i.name);
      assert.ok(indexNames.includes("idx_laws_jurisdiction"));
      assert.ok(indexNames.includes("idx_laws_status"));
      assert.ok(indexNames.includes("idx_articles_law_identifier"));
      assert.ok(indexNames.includes("idx_articles_article_number"));
      assert.ok(indexNames.includes("idx_reforms_law_identifier"));
      assert.ok(indexNames.includes("idx_reforms_date"));
    });
  });

  describe("law records", () => {
    it("should insert and retrieve law record", () => {
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

      db.upsertLaw(record);

      const retrieved = db.getLawMetadata(record.identifier);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.identifier, record.identifier);
      assert.strictEqual(retrieved.title, record.title);
      assert.strictEqual(retrieved.jurisdiction, "es");
    });

    it("should update existing law record", () => {
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

      db.upsertLaw(record);

      // Update with new revision
      record.source_revision = "def456";
      record.last_updated = "2025-02-01";
      db.upsertLaw(record);

      const retrieved = db.getLawMetadata(record.identifier);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.source_revision, "def456");
      assert.strictEqual(retrieved.last_updated, "2025-02-01");
    });

    it("should handle nullable fields", async () => {
      const record = {
        identifier: "TEST-NULL-001",
        title: "Test Law",
        jurisdiction: "es",
        status: "in_force",
        rank: null,
        publication_date: null,
        last_updated: "2025-01-01",
        source_revision: "abc",
        legalize_path: "es/TEST-NULL-001.md",
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

      db.upsertLaw(record);
      const retrieved = db.getLawMetadata(record.identifier);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.rank, null);
      assert.strictEqual(retrieved.boe_url, null);
    });
  });

  describe("article chunks", () => {
    it("should insert and retrieve article chunks", () => {
      const markdown = `# TÍTULO PRELIMINAR

## CAPÍTULO I

### Artículo 1

Texto del artículo uno.`;
      const chunks = chunkMarkdown(
        markdown,
        "BOE-A-1889-4763",
        "es",
        "abc123",
        "es/BOE-A-1889-4763.md",
      );

      assert.strictEqual(chunks.length, 1);
      db.insertArticleChunks(chunks);

      const article = db.getArticle("BOE-A-1889-4763", "1");
      assert.ok(article);
      assert.strictEqual(article.article_number, "1");
      assert.ok(article.text.length > 0);
      assert.strictEqual(article.truncated, false);
    });

    it("should respect max_chars limit", () => {
      const markdown = `# TÍTULO PRELIMINAR

## CAPÍTULO I

### Artículo 1

Texto del artículo uno con suficiente contenido para probar el límite de caracteres.`;
      const chunks = chunkMarkdown(
        markdown,
        "BOE-A-1889-4763",
        "es",
        "abc123",
        "es/BOE-A-1889-4763.md",
      );

      assert.strictEqual(chunks.length, 1);
      db.insertArticleChunks(chunks);

      const article = db.getArticle("BOE-A-1889-4763", "1", 10);
      assert.ok(article);
      assert.ok(article.text.length <= 10);
      assert.strictEqual(article.truncated, true);
    });

    it("should return null for unknown article", () => {
      const article = db.getArticle("UNKNOWN", "999");
      assert.strictEqual(article, null);
    });
  });

  describe("full-text search", () => {
    before(() => {
      // Load inline content for search tests
      const nationalContent = `---
identifier: BOE-A-1889-4763
title: Real Decreto de 24 de julio de 1889 por el que se publica el Código Civil
country: es
rank: real_decreto
publication_date: 1889-07-25
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO PRELIMINAR

## CAPÍTULO I

### Artículo 1

Las fuentes del ordenamiento jurídico español son la ley, la costumbre y los principios generales del derecho.`;
      const nationalFrontmatter = parseFrontmatter(
        nationalContent,
        "test.md",
      );
      const nationalRecord = frontmatterToLawRecord(
        nationalFrontmatter,
        "es/BOE-A-1889-4763.md",
        "abc123",
        "es",
      );
      db.upsertLaw(nationalRecord);

      const nationalBody = extractMarkdownBody(nationalContent);
      const nationalChunks = chunkMarkdown(
        nationalBody,
        "BOE-A-1889-4763",
        "es",
        "abc123",
        "es/BOE-A-1889-4763.md",
      );
      assert.strictEqual(nationalChunks.length, 1, "Should create one chunk for national law");
      db.insertArticleChunks(nationalChunks);

      const regionalContent = `---
identifier: DOGC-1234-2025
title: Ley de protección de datos de Cataluña
country: es
rank: ley
publication_date: 2025-01-15
last_updated: 2025-02-20
status: in_force
source: DOGC
---
# TÍTULO I

Disposiciones generales

## CAPÍTULO ÚNICO

Objeto y ámbito de aplicación

### Artículo 1

La presente ley tiene por objeto regular la protección de las personas físicas en lo que respecta al tratamiento de sus datos de carácter personal en Cataluña.`;
      const regionalFrontmatter = parseFrontmatter(
        regionalContent,
        "test.md",
      );
      const regionalRecord = frontmatterToLawRecord(
        regionalFrontmatter,
        "es-ct/DOGC-1234-2025.md",
        "def456",
        "es-ct",
      );
      db.upsertLaw(regionalRecord);

      const regionalBody = extractMarkdownBody(regionalContent);
      const regionalChunks = chunkMarkdown(
        regionalBody,
        "DOGC-1234-2025",
        "es-ct",
        "def456",
        "es-ct/DOGC-1234-2025.md",
      );
      assert.strictEqual(regionalChunks.length, 1, "Should create one chunk for regional law");
      db.insertArticleChunks(regionalChunks);
    });

    it("should search laws by query", () => {
      const results = db.searchLaws("Código Civil");
      assert.ok(results.length > 0);
      assert.ok(results[0].citation.title.includes("Código Civil"));
    });

    it("should return FTS-backed snippets and scores for body matches", () => {
      const results = db.searchLaws("fuentes");
      assert.ok(results.length > 0);
      assert.ok(results[0].snippet.includes("<mark>fuentes</mark>"));
      assert.ok(results[0].score > 0, "FTS-backed result should have a positive normalized score");
      assert.deepStrictEqual(results[0].matched_fields, ["body"]);
    });

    it("should filter by jurisdiction", () => {
      const results = db.searchLaws("protección", "es-ct");
      assert.ok(results.length > 0);
      assert.strictEqual(results[0].citation.jurisdiction, "es-ct");
    });

    it("should filter by status", () => {
      const results = db.searchLaws("Código", undefined, "in_force");
      assert.ok(results.length > 0);
      results.forEach((r) => {
        assert.strictEqual(r.citation.status, "in_force");
      });
    });

    it("should respect limit", () => {
      const results = db.searchLaws("ley", undefined, undefined, undefined, undefined, undefined, 2);
      assert.ok(results.length <= 2);
    });

    it("should search excerpts within a law", () => {
      const excerpts = db.searchExcerpts("BOE-A-1889-4763", "fuentes");
      assert.ok(excerpts.length > 0);
      assert.ok(excerpts[0].text.length > 0);
      assert.ok(excerpts[0].score > 0, "FTS-backed excerpt should have a positive normalized score");
    });

    it("should return empty array for no matches", () => {
      const results = db.searchLaws("nonexistentxyz123");
      assert.strictEqual(results.length, 0);
    });

    it("should keep FTS consistent when article is updated", () => {
      // Insert initial article
      const markdown = `# TÍTULO I

### Artículo 99

Texto original del artículo.`;
      const chunks = chunkMarkdown(
        markdown,
        "BOE-A-1889-4763",
        "es",
        "abc123",
        "es/BOE-A-1889-4763.md",
      );
      db.insertArticleChunks(chunks);

      // Search should find the article
      let results = db.searchExcerpts("BOE-A-1889-4763", "texto");
      assert.ok(results.length > 0, "Should find original text");

      // Update the article by inserting a new chunk with same article number
      const updatedMarkdown = `# TÍTULO I

### Artículo 99

Texto actualizado del artículo.`;
      const updatedChunks = chunkMarkdown(
        updatedMarkdown,
        "BOE-A-1889-4763",
        "es",
        "def456",
        "es/BOE-A-1889-4763.md",
      );
      db.insertArticleChunks(updatedChunks);

      // Search should find the updated text
      results = db.searchExcerpts("BOE-A-1889-4763", "actualizado");
      assert.ok(results.length > 0, "Should find updated text");

      // Search should still find "texto" in both old and new chunks
      results = db.searchExcerpts("BOE-A-1889-4763", "texto");
      assert.ok(results.length > 0, "Should find text after insert");
      // The trigger ensures FTS is synced for each insert operation
    });

    describe("Spanish Law Research Bug Reproduction", () => {
      before(() => {
        // Add Ley 20/2007 fixture with Article 38 ter
        const ley2007Content = `---
identifier: BOE-A-2007-13409
title: Ley 20/2007, de 11 de julio, del Estatuto del trabajo autónomo
country: es
rank: ley
publication_date: 2007-07-12
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO IV

## CAPÍTULO I

### Artículo 38 ter

Cuota reducida para trabajadores autónomos en el segundo año de actividad. Los trabajadores autónomos que hayan venido disfrutando de la tarifa plana durante el primer año de actividad y cuyos rendimientos netos inferiores al salario mínimo interprofesional podrán beneficiarse de una cuota reducida en el segundo año.`;
        const ley2007Frontmatter = parseFrontmatter(ley2007Content, "test.md");
        const ley2007Record = frontmatterToLawRecord(
          ley2007Frontmatter,
          "es/BOE-A-2007-13409.md",
          "abc123",
          "es",
        );
        db.upsertLaw(ley2007Record);

        const ley2007Body = extractMarkdownBody(ley2007Content);
        const ley2007Chunks = chunkMarkdown(
          ley2007Body,
          "BOE-A-2007-13409",
          "es",
          "abc123",
          "es/BOE-A-2007-13409.md",
        );
        db.insertArticleChunks(ley2007Chunks);

        // Add Real Decreto Legislativo 8/2015 fixture with Article 308
        const rdl2015Content = `---
identifier: BOE-A-2015-11724
title: Real Decreto Legislativo 8/2015, de 30 de octubre, por el que se aprueba el texto refundido de la Ley General de la Seguridad Social
country: es
rank: real_decreto_legislativo
publication_date: 2015-10-31
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO IV

## CAPÍTULO I

### Artículo 307

Campo de aplicación del Régimen Especial de Trabajadores Autónomos.

### Artículo 308

Cotización. La cotización en este régimen especial se realizará de acuerdo con las bases y tipos de cotización establecidos. Los trabajadores autónomos podrán acogerse a bonificaciones o reducciones en la cuota.`;
        const rdl2015Frontmatter = parseFrontmatter(rdl2015Content, "test.md");
        const rdl2015Record = frontmatterToLawRecord(
          rdl2015Frontmatter,
          "es/BOE-A-2015-11724.md",
          "def456",
          "es",
        );
        db.upsertLaw(rdl2015Record);

        const rdl2015Body = extractMarkdownBody(rdl2015Content);
        const rdl2015Chunks = chunkMarkdown(
          rdl2015Body,
          "BOE-A-2015-11724",
          "es",
          "def456",
          "es/BOE-A-2015-11724.md",
        );
        db.insertArticleChunks(rdl2015Chunks);
      });

      it("AC1: search_laws should find Ley 20/2007 for long Spanish query about reduced contribution", () => {
        const query = "cuota reducida autonomos segundo año rendimientos netos inferiores salario mínimo interprofesional artículo 38 ter LGSS";
        const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 10);

        assert.ok(results.length > 0, "Query should return at least one result");
        const ley2007Result = results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Results should include Ley 20/2007 (BOE-A-2007-13409)");
      });

      it("AC1-exact: search_laws should return BOE-A-2007-13409 for exact reported query", () => {
        const exactQuery = "cuota reducida trabajadores autónomos segundo año rendimientos económicos netos inferiores salario mínimo interprofesional";
        const results = db.searchLaws(exactQuery, "es", undefined, undefined, undefined, undefined, 10);

        assert.ok(results.length > 0, "Exact reported query should return at least one result");
        const ley2007Result = results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Exact reported query should return Ley 20/2007 (BOE-A-2007-13409)");
      });

      it("AC1-article-matches: search_laws should include article_matches with canonical '38 ter' for reported query", () => {
        const exactQuery = "cuota reducida trabajadores autónomos segundo año rendimientos económicos netos inferiores salario mínimo interprofesional";
        const results = db.searchLaws(exactQuery, "es", undefined, undefined, undefined, undefined, 10);

        assert.ok(results.length > 0, "Exact reported query should return at least one result");
        const ley2007Result = results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Exact reported query should return Ley 20/2007 (BOE-A-2007-13409)");
        assert.ok(ley2007Result.article_matches, "Result should include article_matches");
        assert.ok(Array.isArray(ley2007Result.article_matches), "article_matches should be an array");
        assert.ok(ley2007Result.article_matches.length > 0, "article_matches should have at least one entry");

        const article38TerMatch = ley2007Result.article_matches.find(m => m.article_number === "38 ter");
        assert.ok(article38TerMatch, "article_matches should include canonical '38 ter'");
        assert.strictEqual(article38TerMatch.article_number, "38 ter");
        assert.ok(Array.isArray(article38TerMatch.heading_path));
        assert.ok(typeof article38TerMatch.snippet === "string");
        assert.ok(article38TerMatch.snippet.length > 0);
      });

      it("AC1-next-tool: search_laws should include next_tool for BOE-A-2007-13409 / 38 ter result", () => {
        const exactQuery = "cuota reducida trabajadores autónomos segundo año rendimientos económicos netos inferiores salario mínimo interprofesional";
        const results = db.searchLaws(exactQuery, "es", undefined, undefined, undefined, undefined, 10);

        assert.ok(results.length > 0, "Exact reported query should return at least one result");
        const ley2007Result = results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Exact reported query should return Ley 20/2007 (BOE-A-2007-13409)");
        assert.ok(ley2007Result.next_tool, "Result should include next_tool when article_matches exist");
        assert.strictEqual(ley2007Result.next_tool?.name, "get_article");
        assert.strictEqual(ley2007Result.next_tool?.arguments.identifier, "BOE-A-2007-13409");
        assert.strictEqual(ley2007Result.next_tool?.arguments.article_number, "38 ter");
        assert.strictEqual(ley2007Result.next_tool?.arguments.jurisdiction, "es");
      });

      it("should not include next_tool for title-only results without article matches", () => {
        const titleOnlyContent = `---
identifier: BOE-A-TEST-TITLE-ONLY-001
title: Ley marcador exclusivo alphaomega
country: es
rank: ley
publication_date: 2025-01-01
last_updated: 2025-01-01
status: in_force
source: BOE
---
# TÍTULO I

### Artículo 1

Texto sin coincidencias relevantes.`;
        const titleOnlyFrontmatter = parseFrontmatter(titleOnlyContent, "test.md");
        const titleOnlyRecord = frontmatterToLawRecord(
          titleOnlyFrontmatter,
          "es/BOE-A-TEST-TITLE-ONLY-001.md",
          "abc123",
          "es",
        );
        db.upsertLaw(titleOnlyRecord);

        const titleOnlyBody = extractMarkdownBody(titleOnlyContent);
        const titleOnlyChunks = chunkMarkdown(
          titleOnlyBody,
          "BOE-A-TEST-TITLE-ONLY-001",
          "es",
          "abc123",
          "es/BOE-A-TEST-TITLE-ONLY-001.md",
        );
        db.insertArticleChunks(titleOnlyChunks);

        const results = db.searchLaws("Ley marcador exclusivo alphaomega", "es", undefined, undefined, undefined, undefined, 10);

        assert.ok(results.length > 0, "Query should return at least one result");
        const titleOnlyResult = results.find(r => r.citation.identifier === "BOE-A-TEST-TITLE-ONLY-001");
        assert.ok(titleOnlyResult, "Query should return the title-only fixture");
        assert.deepStrictEqual(titleOnlyResult.matched_fields, ["title"]);
        assert.strictEqual(titleOnlyResult.article_matches, undefined);
        assert.strictEqual(titleOnlyResult.next_tool, undefined, "Title-only results should not have next_tool");
      });

      it("should map Spanish status 'vigente' to in_force for Article 38 ter search", () => {
        const query = "artículo 38 ter Ley 20/2007 tarifa reducida segundo año rendimientos netos salario mínimo interprofesional";
        const results = db.searchLaws(query, "es", "vigente", undefined, undefined, undefined, 10);

        const ley2007Result = results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Spanish status alias should not filter out Ley 20/2007");
        assert.strictEqual(ley2007Result.citation.status, "in_force");
        assert.ok(
          ley2007Result.article_matches?.some(match => match.article_number === "38 ter"),
          "article_matches should include Article 38 ter",
        );
      });

      it("should map Spanish status 'vigente' for reduced contribution search", () => {
        const query = "cuota reducida trabajadores por cuenta propia artículo 38 ter";
        const results = db.searchLaws(query, "es", "vigente", undefined, undefined, undefined, 10);

        const ley2007Result = results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Spanish status alias should not filter out Ley 20/2007");
        assert.strictEqual(ley2007Result.citation.status, "in_force");
        assert.ok(
          ley2007Result.article_matches?.some(match => match.article_number === "38 ter"),
          "article_matches should include Article 38 ter",
        );
      });

      it("AC2: search_laws should find same law family for alternative reduced contribution query", () => {
        const query = "tarifa plana cuota reducida trabajadores autónomos segundo periodo rendimientos económicos netos salario mínimo interprofesional";
        const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 10);

        assert.ok(results.length > 0, "Query should return at least one result");
        const ley2007Result = results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Results should include Ley 20/2007 (BOE-A-2007-13409)");
      });

      it("should expand synonyms for Spanish legal concepts", () => {
        // Test that alias "cuota reducida" finds content containing synonym "tarifa plana"
        const results = db.searchLaws("cuota reducida", "es", undefined, undefined, undefined, undefined, 10);

        assert.ok(results.length > 0, "Alias search should find results");
        const ley2007Result = results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Alias 'cuota reducida' should find Ley 20/2007 which contains 'tarifa plana'");
      });

      it("should prove alias-only retrieval with phrase-based expansion", () => {
        // Create a fixture that contains only "tarifa plana" (not "cuota reducida")
        const aliasOnlyContent = `---
identifier: BOE-A-TEST-ALIAS-001
title: Ley de prueba para alias
country: es
rank: ley
publication_date: 2025-01-01
last_updated: 2025-01-01
status: in_force
source: BOE
---
# TÍTULO I

### Artículo 1

Los trabajadores autónomos podrán acogerse a la tarifa plana durante el primer año de actividad.`;
        const aliasOnlyFrontmatter = parseFrontmatter(aliasOnlyContent, "test.md");
        const aliasOnlyRecord = frontmatterToLawRecord(
          aliasOnlyFrontmatter,
          "es/BOE-A-TEST-ALIAS-001.md",
          "abc123",
          "es",
        );
        db.upsertLaw(aliasOnlyRecord);

        const aliasOnlyBody = extractMarkdownBody(aliasOnlyContent);
        const aliasOnlyChunks = chunkMarkdown(
          aliasOnlyBody,
          "BOE-A-TEST-ALIAS-001",
          "es",
          "abc123",
          "es/BOE-A-TEST-ALIAS-001.md",
        );
        db.insertArticleChunks(aliasOnlyChunks);

        // Search using the alias "cuota reducida" (not present in the fixture)
        const results = db.searchLaws("cuota reducida", "es", undefined, undefined, undefined, undefined, 10);

        assert.ok(results.length > 0, "Alias search should find results through phrase-based expansion");
        const aliasOnlyResult = results.find(r => r.citation.identifier === "BOE-A-TEST-ALIAS-001");
        assert.ok(aliasOnlyResult, "Alias 'cuota reducida' should find fixture containing only 'tarifa plana'");
      });

      it("should preserve article numbers in search queries", () => {
        const results = db.searchLaws("38 ter", "es", undefined, undefined, undefined, undefined, 10);
        assert.ok(results.length > 0, "Article number search should find results");
        const ley2007Result = results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Article number search should find Ley 20/2007");
      });

      it("should return unique law identifiers for long Spanish query (deduplication regression test)", () => {
        const query = "cuota reducida autonomos segundo año rendimientos netos inferiores salario mínimo interprofesional artículo 38 ter LGSS";
        const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 10);

        assert.ok(results.length > 0, "Query should return at least one result");

        // Extract all identifiers from results
        const identifiers = results.map(r => r.citation.identifier);

        // Check that all identifiers are unique
        const uniqueIdentifiers = new Set(identifiers);
        assert.strictEqual(
          identifiers.length,
          uniqueIdentifiers.size,
          `search_laws should return unique law identifiers. Found duplicates: ${identifiers}`
        );
      });

      it("should not recover '38 ter' from a normal Article '38' without trailing space (negative regression)", () => {
        // Add a fixture with both Article 38 (normal) and Article 38 ter (suffix)
        const mixedContent = `---
identifier: BOE-A-TEST-MIXED-001
title: Ley de prueba para artículos mixtos
country: es
rank: ley
publication_date: 2025-01-01
last_updated: 2025-01-01
status: in_force
source: BOE
---
# TÍTULO I

### Artículo 38

Texto del artículo 38 normal (sin sufijo).

### Artículo 38 ter

Texto del artículo 38 ter con sufijo.`;
        const mixedFrontmatter = parseFrontmatter(mixedContent, "test.md");
        const mixedRecord = frontmatterToLawRecord(
          mixedFrontmatter,
          "es/BOE-A-TEST-MIXED-001.md",
          "abc123",
          "es",
        );
        db.upsertLaw(mixedRecord);

        const mixedBody = extractMarkdownBody(mixedContent);
        const mixedChunks = chunkMarkdown(
          mixedBody,
          "BOE-A-TEST-MIXED-001",
          "es",
          "abc123",
          "es/BOE-A-TEST-MIXED-001.md",
        );
        db.insertArticleChunks(mixedChunks);

        // Request Article "38 ter" - should return the actual Article 38 ter
        const articleTer = db.getArticle("BOE-A-TEST-MIXED-001", "38 ter");
        assert.ok(articleTer, "Should find Article 38 ter");
        assert.strictEqual(articleTer?.article_number, "38 ter");
        assert.ok(articleTer?.text.includes("Texto del artículo 38 ter"));

        // Request Article "38" - should return the normal Article 38, NOT 38 ter
        const articleNormal = db.getArticle("BOE-A-TEST-MIXED-001", "38");
        assert.ok(articleNormal, "Should find Article 38");
        assert.strictEqual(articleNormal?.article_number, "38");
        assert.ok(articleNormal?.text.includes("Texto del artículo 38 normal"));

        // Negative regression: requesting "38 ter" should NOT match stored "38" (without trailing space)
        // The safe fallback requires trailing space as a malformed indicator
        // This test verifies that recoverCanonicalArticleNumber("38", "38 ter") returns null
        const recoveryResult = recoverCanonicalArticleNumber("38", "38 ter");
        assert.strictEqual(recoveryResult, null, "Should not recover '38 ter' from plain '38' without trailing space");
      });

      it("should return unique law identifiers for alternative long Spanish query (deduplication regression test)", () => {
        const query = "tarifa plana cuota reducida trabajadores autónomos segundo periodo rendimientos económicos netos salario mínimo interprofesional";
        const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 10);

        assert.ok(results.length > 0, "Query should return at least one result");

        // Extract all identifiers from results
        const identifiers = results.map(r => r.citation.identifier);

        // Check that all identifiers are unique
        const uniqueIdentifiers = new Set(identifiers);
        assert.strictEqual(
          identifiers.length,
          uniqueIdentifiers.size,
          `search_laws should return unique law identifiers. Found duplicates: ${identifiers}`
        );
      });

      describe("exact article routing regression tests", () => {
        before(() => {
          const lauContent = `---
identifier: BOE-A-1994-26003
title: Ley 29/1994, de 24 de noviembre, de Arrendamientos Urbanos
country: es
rank: ley
publication_date: 1994-11-25
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO III

## CAPÍTULO II

### Artículo 36

Fianza. A la celebración del contrato será obligatoria la exigencia y prestación de fianza en metálico en cantidad equivalente a una mensualidad de renta en el arrendamiento de viviendas.

### Artículo 37

Formalización del arrendamiento. Las partes podrán compelerse recíprocamente a la formalización por escrito del contrato de arrendamiento, incluyendo la fianza pactada.`;
          const lauFrontmatter = parseFrontmatter(lauContent, "test.md");
          const lauRecord = frontmatterToLawRecord(
            lauFrontmatter,
            "es/BOE-A-1994-26003.md",
            "abc123",
            "es",
          );
          db.upsertLaw(lauRecord);

          const lauBody = extractMarkdownBody(lauContent);
          const lauChunks = chunkMarkdown(
            lauBody,
            "BOE-A-1994-26003",
            "es",
            "abc123",
            "es/BOE-A-1994-26003.md",
          );
          db.insertArticleChunks(lauChunks);

          const etContent = `---
identifier: BOE-A-2015-11430
title: Real Decreto Legislativo 2/2015, de 23 de octubre, por el que se aprueba el texto refundido de la Ley del Estatuto de los Trabajadores
country: es
rank: real_decreto_legislativo
publication_date: 2015-10-24
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO I

## CAPÍTULO III

### Artículo 56

Despido improcedente. Cuando el despido sea declarado improcedente, el empresario podrá optar entre la readmisión del trabajador o el abono de una indemnización de treinta y tres días de salario por año de servicio.

### Artículo 92

Infracciones y sanciones. Las referencias históricas a indemnización por despido improcedente y treinta y tres días de salario no alteran el régimen sancionador previsto en este artículo.`;
          const etFrontmatter = parseFrontmatter(etContent, "test.md");
          const etRecord = frontmatterToLawRecord(
            etFrontmatter,
            "es/BOE-A-2015-11430.md",
            "def456",
            "es",
          );
          db.upsertLaw(etRecord);

          const etBody = extractMarkdownBody(etContent);
          const etChunks = chunkMarkdown(
            etBody,
            "BOE-A-2015-11430",
            "es",
            "def456",
            "es/BOE-A-2015-11430.md",
          );
          db.insertArticleChunks(etChunks);

          const civilCodeContent = `---
identifier: BOE-A-1889-4763
title: Real Decreto de 24 de julio de 1889 por el que se publica el Código Civil
country: es
rank: real_decreto
publication_date: 1889-07-25
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO PRELIMINAR

## CAPÍTULO II

### Artículo 22

Nacionalidad por residencia. La nacionalidad española se adquiere por residencia en España. Para ser admitido a la nacionalidad por residencia es necesario que la persona resida en España durante diez años.

### Artículo 23

Nacionalidad por opción. Tienen derecho a optar por la nacionalidad española las personas que hayan estado sujetas a la patria potestad o tutela de español.`;
          const civilCodeFrontmatter = parseFrontmatter(civilCodeContent, "test.md");
          const civilCodeRecord = frontmatterToLawRecord(
            civilCodeFrontmatter,
            "es/BOE-A-1889-4763.md",
            "ghi789",
            "es",
          );
          db.upsertLaw(civilCodeRecord);

          const civilCodeBody = extractMarkdownBody(civilCodeContent);
          const civilCodeChunks = chunkMarkdown(
            civilCodeBody,
            "BOE-A-1889-4763",
            "es",
            "ghi789",
            "es/BOE-A-1889-4763.md",
          );
          db.insertArticleChunks(civilCodeChunks);

          const reformContent = `---
identifier: BOE-A-2002-12345
title: Ley 36/2002, de 8 de octubre, de modificación del Código Civil en materia de nacionalidad
country: es
rank: ley
publication_date: 2002-10-09
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO ÚNICO

### Artículo 1

Modificación del artículo 22 del Código Civil. Se modifica el artículo 22 del Código Civil para reducir el periodo de residencia necesario para la adquisición de la nacionalidad española.`;
          const reformFrontmatter = parseFrontmatter(reformContent, "test.md");
          const reformRecord = frontmatterToLawRecord(
            reformFrontmatter,
            "es/BOE-A-2002-12345.md",
            "jkl012",
            "es",
          );
          db.upsertLaw(reformRecord);

          const reformBody = extractMarkdownBody(reformContent);
          const reformChunks = chunkMarkdown(
            reformBody,
            "BOE-A-2002-12345",
            "es",
            "jkl012",
            "es/BOE-A-2002-12345.md",
          );
          db.insertArticleChunks(reformChunks);

          const suffixContent = `---
identifier: BOE-A-TEST-ROUTING-SUFFIX-001
title: Ley de prueba para enrutamiento de artículos con sufijo
country: es
rank: ley
publication_date: 2025-01-01
last_updated: 2025-01-01
status: in_force
source: BOE
---
# TÍTULO I

### Artículo 38

Texto del artículo 38 ordinario.

### Artículo 38 ter

Texto del artículo 38 ter con sufijo.`;
          const suffixFrontmatter = parseFrontmatter(suffixContent, "test.md");
          const suffixRecord = frontmatterToLawRecord(
            suffixFrontmatter,
            "es/BOE-A-TEST-ROUTING-SUFFIX-001.md",
            "mno345",
            "es",
          );
          db.upsertLaw(suffixRecord);

          const suffixBody = extractMarkdownBody(suffixContent);
          const suffixChunks = chunkMarkdown(
            suffixBody,
            "BOE-A-TEST-ROUTING-SUFFIX-001",
            "es",
            "mno345",
            "es/BOE-A-TEST-ROUTING-SUFFIX-001.md",
          );
          db.insertArticleChunks(suffixChunks);
        });

        it("LAU Article 36: search with explicit article reference should prioritize Article 36 over Article 37", () => {
          const query = "fianza alquiler vivienda Ley de Arrendamientos Urbanos artículo 36";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 10);

          const lauResult = results.find(r => r.citation.identifier === "BOE-A-1994-26003");
          assert.ok(lauResult, "Query should find LAU law");
          assert.ok(lauResult.article_matches, "Result should include article_matches");

          const firstMatch = lauResult.article_matches![0];
          assert.strictEqual(firstMatch.article_number, "36", "First article match should be Article 36");
          assert.strictEqual(lauResult.next_tool?.arguments.article_number, "36", "next_tool should point to Article 36");
        });

        it("LAU Article 36: search with 'art.' prefix should prioritize Article 36", () => {
          const query = "Arrendamientos Urbanos art. 36 fianza vivienda";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 10);

          const lauResult = results.find(r => r.citation.identifier === "BOE-A-1994-26003");
          assert.ok(lauResult, "Query should find LAU law");
          assert.ok(lauResult.article_matches, "Result should include article_matches");

          const firstMatch = lauResult.article_matches![0];
          assert.strictEqual(firstMatch.article_number, "36", "First article match should be Article 36");
        });

        it("Estatuto de los Trabajadores Article 56: search should prioritize Article 56 over transitional provisions", () => {
          const query = "despido improcedente indemnización treinta y tres días salario artículo 56 Estatuto de los Trabajadores";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 10);

          const etResult = results.find(r => r.citation.identifier === "BOE-A-2015-11430");
          assert.ok(etResult, "Query should find Estatuto de los Trabajadores");
          assert.ok(etResult.article_matches, "Result should include article_matches");

          const firstMatch = etResult.article_matches![0];
          assert.strictEqual(firstMatch.article_number, "56", "First article match should be Article 56");
          assert.strictEqual(etResult.next_tool?.arguments.article_number, "56", "next_tool should point to Article 56");
        });

        it("Código Civil Article 22: search with code name and article should include consolidated code", () => {
          const query = "Código Civil artículo 22 nacionalidad por residencia";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 10);

          const civilCodeResult = results.find(r => r.citation.identifier === "BOE-A-1889-4763");
          assert.ok(civilCodeResult, "Query should find the consolidated Código Civil");

          const article22Match = civilCodeResult.article_matches?.find(m => m.article_number === "22");
          assert.ok(article22Match, "article_matches should include Article 22");
          assert.strictEqual(civilCodeResult.article_matches?.[0]?.article_number, "22", "First article match should be Article 22");
          assert.strictEqual(civilCodeResult.next_tool?.arguments.article_number, "22", "next_tool should point to Article 22");
        });

        it("standalone suffix article reference should route to the full suffix article", () => {
          const results = db.searchLaws("38 ter", "es", undefined, undefined, undefined, undefined, 10);

          const suffixResult = results.find(r => r.citation.identifier === "BOE-A-TEST-ROUTING-SUFFIX-001");
          assert.ok(suffixResult, "Query should find suffix article fixture");
          assert.strictEqual(suffixResult.article_matches?.[0]?.article_number, "38 ter");
          assert.strictEqual(suffixResult.next_tool?.arguments.article_number, "38 ter");
        });
      });
    });

    describe("Role eval ranking improvements", () => {
      before(() => {
        // Add Código Civil fixture with Article 22 (nationality by residence)
        const codigoCivilContent = `---
identifier: BOE-A-1889-4763
title: Real Decreto de 24 de julio de 1889 por el que se publica el Código Civil
country: es
rank: real_decreto
publication_date: 1889-07-25
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO I

## CAPÍTULO II

### Artículo 22

La nacionalidad española se adquiere por residencia.

### Artículo 23

Disposiciones sobre nacionalidad.`;
        const codigoCivilFrontmatter = parseFrontmatter(codigoCivilContent, "test.md");
        const codigoCivilRecord = frontmatterToLawRecord(
          codigoCivilFrontmatter,
          "es/BOE-A-1889-4763.md",
          "abc123",
          "es",
        );
        db.upsertLaw(codigoCivilRecord);

        const codigoCivilBody = extractMarkdownBody(codigoCivilContent);
        const codigoCivilChunks = chunkMarkdown(
          codigoCivilBody,
          "BOE-A-1889-4763",
          "es",
          "abc123",
          "es/BOE-A-1889-4763.md",
        );
        db.insertArticleChunks(codigoCivilChunks);

        // Add reform law for nationality
        const reformaContent = `---
identifier: BOE-A-2020-12345
title: Ley de reforma de la nacionalidad por residencia
country: es
rank: ley
publication_date: 2020-01-01
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO ÚNICO

### Artículo 1

Modificación del Código Civil en materia de nacionalidad.`;
        const reformaFrontmatter = parseFrontmatter(reformaContent, "test.md");
        const reformaRecord = frontmatterToLawRecord(
          reformaFrontmatter,
          "es/BOE-A-2020-12345.md",
          "def456",
          "es",
        );
        db.upsertLaw(reformaRecord);

        const reformaBody = extractMarkdownBody(reformaContent);
        const reformaChunks = chunkMarkdown(
          reformaBody,
          "BOE-A-2020-12345",
          "es",
          "def456",
          "es/BOE-A-2020-12345.md",
        );
        db.insertArticleChunks(reformaChunks);

        // Add Estatuto de los Trabajadores fixture with Article 56 (unfair dismissal)
        const estatutoContent = `---
identifier: BOE-A-2015-11430
title: Real Decreto Legislativo 2/2015, de 23 de octubre, por el que se aprueba el texto refundido de la Ley del Estatuto de los Trabajadores
country: es
rank: real_decreto_legislativo
publication_date: 2015-10-24
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO II

## CAPÍTULO I

### Artículo 56

Cuando el despido sea declarado improcedente, el empresario podrá optar entre la readmisión del trabajador o el abono de una indemnización equivalente a treinta y tres días de salario por año de servicio.

### Artículo 92

Infracciones y sanciones por incumplimientos laborales.`;
        const estatutoFrontmatter = parseFrontmatter(estatutoContent, "test.md");
        const estatutoRecord = frontmatterToLawRecord(
          estatutoFrontmatter,
          "es/BOE-A-2015-11430.md",
          "abc123",
          "es",
        );
        db.upsertLaw(estatutoRecord);

        const estatutoBody = extractMarkdownBody(estatutoContent);
        const estatutoChunks = chunkMarkdown(
          estatutoBody,
          "BOE-A-2015-11430",
          "es",
          "abc123",
          "es/BOE-A-2015-11430.md",
        );
        db.insertArticleChunks(estatutoChunks);

        // Add Real Decreto 1155/2024 fixture with Articles 80, 86, 87
        const rd1155Content = `---
identifier: BOE-A-2024-24099
title: Real Decreto 1155/2024, de 19 de noviembre, por el que se aprueba el Reglamento de la Ley Orgánica 4/2000, de 11 de enero, sobre derechos y libertades de los extranjeros en España y su integración social
country: es
rank: real_decreto
publication_date: 2024-09-25
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO III

## CAPÍTULO I

### Artículo 80

La autorización de residencia temporal y trabajo por cuenta ajena se renovará cuando se mantenga la relación laboral o cuando el trabajador haya perdido el empleo por causas ajenas a su voluntad y cumpla los requisitos previstos.

### Artículo 81

La autorización renovada surtirá efectos desde el día siguiente a la caducidad de la autorización anterior.

### Artículo 86

La autorización de residencia temporal y trabajo por cuenta propia se renovará cuando se acredite la continuidad de la actividad por cuenta propia y el cumplimiento de las obligaciones tributarias y de Seguridad Social.

### Artículo 87

Los efectos de la renovación de la autorización de residencia y trabajo por cuenta propia se mantendrán durante el periodo previsto en este reglamento.`;
        const rd1155Frontmatter = parseFrontmatter(rd1155Content, "test.md");
        const rd1155Record = frontmatterToLawRecord(
          rd1155Frontmatter,
          "es/BOE-A-2024-24099.md",
          "abc123",
          "es",
        );
        db.upsertLaw(rd1155Record);

        const rd1155Body = extractMarkdownBody(rd1155Content);
        const rd1155Chunks = chunkMarkdown(
          rd1155Body,
          "BOE-A-2024-24099",
          "es",
          "abc123",
          "es/BOE-A-2024-24099.md",
        );
        db.insertArticleChunks(rd1155Chunks);
      });

      it("should prefer Código Civil over reform laws for nationality by residence query", () => {
        const query = "Código Civil nacionalidad por residencia";
        const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

        assert.ok(results.length > 0, "Query should return at least one result");
        assert.strictEqual(results[0].citation.identifier, "BOE-A-1889-4763");
        assert.strictEqual(results[0].article_matches?.[0]?.article_number, "22");
        assert.strictEqual(results[0].next_tool?.arguments.article_number, "22");
      });

      it("should prefer Article 22 over other articles for Código Civil nationality query", () => {
        const query = "nacionalidad espanola por residencia diez anos iberoamericanos refugiado";
        const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

        const codigoCivilResult = results.find(r => r.citation.identifier === "BOE-A-1889-4763");
        assert.ok(codigoCivilResult, "Results should include Código Civil");
        assert.ok(codigoCivilResult.article_matches, "Result should include article_matches");

        assert.strictEqual(codigoCivilResult.article_matches?.[0]?.article_number, "22");
        assert.strictEqual(codigoCivilResult.next_tool?.arguments.article_number, "22");
      });

      it("should prefer Article 56 over transitional provisions for Estatuto de los Trabajadores unfair dismissal query", () => {
        const query = "Estatuto de los Trabajadores despido improcedente indemnización treinta y tres días salario";
        const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

        assert.ok(results.length > 0, "Query should return at least one result");
        const estatutoResult = results[0];
        assert.strictEqual(estatutoResult.citation.identifier, "BOE-A-2015-11430");
        assert.ok(estatutoResult.article_matches, "Result should include article_matches");
        assert.strictEqual(estatutoResult.article_matches?.[0]?.article_number, "56");
        assert.strictEqual(estatutoResult.next_tool?.arguments.article_number, "56");
      });

      it("should prefer account-employed renewal requirements over effects for Real Decreto 1155/2024", () => {
        const query = "Real Decreto 1155/2024 renovación autorización residencia trabajo cuenta ajena pérdida empleo requisitos";
        const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

        assert.ok(results.length > 0, "Query should return at least one result");
        const rd1155Result = results[0];
        assert.strictEqual(rd1155Result.citation.identifier, "BOE-A-2024-24099");
        assert.ok(rd1155Result.article_matches, "Result should include article_matches");
        assert.strictEqual(rd1155Result.article_matches?.[0]?.article_number, "80");
        assert.strictEqual(rd1155Result.next_tool?.arguments.article_number, "80");
      });

      it("should prefer self-employed renewal requirements over effects for Real Decreto 1155/2024", () => {
        const query = "Real Decreto 1155/2024 renovación residencia trabajo cuenta propia continuidad actividad obligaciones Seguridad Social";
        const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

        assert.ok(results.length > 0, "Query should return at least one result");
        const rd1155Result = results[0];
        assert.strictEqual(rd1155Result.citation.identifier, "BOE-A-2024-24099");
        assert.ok(rd1155Result.article_matches, "Result should include article_matches");
        assert.strictEqual(rd1155Result.article_matches?.[0]?.article_number, "86");
        assert.strictEqual(rd1155Result.next_tool?.arguments.article_number, "86");
      });

      it("should boost in_force sources over repealed sources when status not explicitly requested", () => {
        // Add a repealed law
        const repealedContent = `---
identifier: BOE-A-REPEALED-001
title: Ley derogada sobre nacionalidad
country: es
rank: ley
publication_date: 1990-01-01
last_updated: 2025-01-03
status: repealed
source: BOE
---
# TÍTULO I

### Artículo 1

La nacionalidad española se adquiere por residencia según esta ley derogada.`;
        const repealedFrontmatter = parseFrontmatter(repealedContent, "test.md");
        const repealedRecord = frontmatterToLawRecord(
          repealedFrontmatter,
          "es/BOE-A-REPEALED-001.md",
          "abc123",
          "es",
        );
        db.upsertLaw(repealedRecord);

        const repealedBody = extractMarkdownBody(repealedContent);
        const repealedChunks = chunkMarkdown(
          repealedBody,
          "BOE-A-REPEALED-001",
          "es",
          "abc123",
          "es/BOE-A-REPEALED-001.md",
        );
        db.insertArticleChunks(repealedChunks);

        const query = "nacionalidad residencia";
        const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

        assert.ok(results.length > 0, "Query should return at least one result");
        const repealedResults = results.filter(r => r.citation.status === "repealed");

        assert.ok(repealedResults.length > 0, "Query should include the repealed control result");
        assert.strictEqual(results[0].citation.status, "in_force");
      });

      describe("topic hints for role eval scenarios", () => {
        before(() => {
          // Add LAU fixture with Article 36 (housing deposit guarantees)
          const lauContent = `---
identifier: BOE-A-1994-26003
title: Ley 29/1994, de 24 de noviembre, de Arrendamientos Urbanos
country: es
rank: ley
publication_date: 2019-12-10
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO I

## CAPÍTULO ÚNICO

### Artículo 36

Fianza. La fianza se depositará en cualquiera de las formas previstas en la legislación vigente. En caso de incumplimiento, el arrendador podrá hacer efectiva la garantía.`;
          const lauFrontmatter = parseFrontmatter(lauContent, "test.md");
          const lauRecord = frontmatterToLawRecord(
            lauFrontmatter,
            "es/BOE-A-1994-26003.md",
            "abc123",
            "es",
          );
          db.upsertLaw(lauRecord);

          const lauBody = extractMarkdownBody(lauContent);
          const lauChunks = chunkMarkdown(
            lauBody,
            "BOE-A-1994-26003",
            "es",
            "abc123",
            "es/BOE-A-1994-26003.md",
          );
          db.insertArticleChunks(lauChunks);

          // Add Constitution fixture with Article 18 (privacy/home/communications)
          const constitutionContent = `---
identifier: BOE-A-1978-31229
title: Constitución Española
country: es
rank: constitucion
publication_date: 1978-12-29
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO I

## CAPÍTULO I

### Artículo 18

Se garantiza el derecho al honor, a la intimidad personal y familiar y a la propia imagen. El domicilio es inviolable. Ninguna entrada o registro podrá hacerse en él sin consentimiento del titular o resolución judicial. Se garantiza el secreto de las comunicaciones.`;
          const constitutionFrontmatter = parseFrontmatter(constitutionContent, "test.md");
          const constitutionRecord = frontmatterToLawRecord(
            constitutionFrontmatter,
            "es/BOE-A-1978-31229.md",
            "def456",
            "es",
          );
          db.upsertLaw(constitutionRecord);

          const constitutionBody = extractMarkdownBody(constitutionContent);
          const constitutionChunks = chunkMarkdown(
            constitutionBody,
            "BOE-A-1978-31229",
            "es",
            "def456",
            "es/BOE-A-1978-31229.md",
          );
          db.insertArticleChunks(constitutionChunks);

          // Add LPAC fixture with Article 14 (electronic administration obligations)
          const lpacContent = `---
identifier: BOE-A-2015-10565
title: Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas
country: es
rank: ley
publication_date: 2015-10-02
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO II

### Artículo 14

Derecho y obligación de relacionarse electrónicamente con las Administraciones Públicas. Las personas jurídicas y determinados sujetos están obligados a relacionarse a través de medios electrónicos.

### Artículo 53

Derechos del interesado en el procedimiento administrativo.`;
          const lpacFrontmatter = parseFrontmatter(lpacContent, "test.md");
          const lpacRecord = frontmatterToLawRecord(
            lpacFrontmatter,
            "es/BOE-A-2015-10565.md",
            "mno345",
            "es",
          );
          db.upsertLaw(lpacRecord);

          const lpacBody = extractMarkdownBody(lpacContent);
          const lpacChunks = chunkMarkdown(
            lpacBody,
            "BOE-A-2015-10565",
            "es",
            "mno345",
            "es/BOE-A-2015-10565.md",
          );
          db.insertArticleChunks(lpacChunks);

          // Add Código Civil fixture with Articles 1101 and 1902
          const civilCodeContent = `---
identifier: BOE-A-1889-4763
title: Real Decreto de 24 de julio de 1889 por el que se publica el Código Civil
country: es
rank: real_decreto
publication_date: 1889-07-25
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO I

## CAPÍTULO I

### Artículo 1101

Quedan sujetos a la indemnización de los daños y perjuicios causados los que en el cumplimiento de sus obligaciones incurrieren en dolo, negligencia o morosidad, y los que de cualquier modo contravinieren al tenor de aquéllas.

### Artículo 1902

El que por acción u omisión causa daño a otro, interviniendo culpa o negligencia, está obligado a reparar el daño causado.`;
          const civilCodeFrontmatter = parseFrontmatter(civilCodeContent, "test.md");
          const civilCodeRecord = frontmatterToLawRecord(
            civilCodeFrontmatter,
            "es/BOE-A-1889-4763.md",
            "ghi789",
            "es",
          );
          db.upsertLaw(civilCodeRecord);

          const civilCodeBody = extractMarkdownBody(civilCodeContent);
          const civilCodeChunks = chunkMarkdown(
            civilCodeBody,
            "BOE-A-1889-4763",
            "es",
            "ghi789",
            "es/BOE-A-1889-4763.md",
          );
          db.insertArticleChunks(civilCodeChunks);

          // Add Criminal Code fixture with Articles 234 and 379
          const criminalCodeContent = `---
identifier: BOE-A-1995-25444
title: Ley Orgánica 10/1995, de 23 de noviembre, del Código Penal
country: es
rank: ley_organica
publication_date: 1995-11-24
last_updated: 2025-01-03
status: in_force
source: BOE
---
# TÍTULO I

## CAPÍTULO I

### Artículo 234

El que, con ánimo de lucro, tomare las cosas muebles ajenas sin la voluntad de su dueño será castigado con la pena de prisión de seis a dieciocho meses.

### Artículo 379

El que condujere un vehículo de motor bajo la influencia de drogas tóxicas, estupefacientes, sustancias psicotrópicas o de bebidas alcohólicas será castigado con la pena de prisión de tres a seis meses.`;
          const criminalCodeFrontmatter = parseFrontmatter(criminalCodeContent, "test.md");
          const criminalCodeRecord = frontmatterToLawRecord(
            criminalCodeFrontmatter,
            "es/BOE-A-1995-25444.md",
            "jkl012",
            "es",
          );
          db.upsertLaw(criminalCodeRecord);

          const criminalCodeBody = extractMarkdownBody(criminalCodeContent);
          const criminalCodeChunks = chunkMarkdown(
            criminalCodeBody,
            "BOE-A-1995-25444",
            "es",
            "jkl012",
            "es/BOE-A-1995-25444.md",
          );
          db.insertArticleChunks(criminalCodeChunks);
        });

        it("should route LAU Article 36 for fianza/guarantee housing queries", () => {
          const query = "fianza garantia deposito arrendamiento vivienda";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

          assert.ok(results.length > 0, "Query should return at least one result");
          const lauResult = results.find(r => r.citation.identifier === "BOE-A-1994-26003");
          assert.ok(lauResult, "Results should include LAU (BOE-A-1994-26003)");
          assert.ok(lauResult.article_matches, "Result should include article_matches");
          const article36Match = lauResult.article_matches?.find(m => m.article_number === "36");
          assert.ok(article36Match, "article_matches should include Article 36");
        });

        it("should prioritize LAU Article 36 for additional housing guarantee wording", () => {
          const query = "Ley 29 1994 fianza vivienda garantias adicionales arrendaticias";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

          const lauResult = results.find(r => r.citation.identifier === "BOE-A-1994-26003");
          assert.ok(lauResult, "Results should include LAU (BOE-A-1994-26003)");
          assert.strictEqual(lauResult.article_matches?.[0]?.article_number, "36");
          assert.strictEqual(lauResult.next_tool?.arguments.article_number, "36");
        });

        it("should route Constitution Article 18 for privacy/home/communications queries", () => {
          const query = "privacidad domicilio comunicaciones inviolabilidad";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

          assert.ok(results.length > 0, "Query should return at least one result");
          const constitutionResult = results.find(r => r.citation.identifier === "BOE-A-1978-31229");
          assert.ok(constitutionResult, "Results should include Constitution (BOE-A-1978-31229)");
          assert.ok(constitutionResult.article_matches, "Result should include article_matches");
          const article18Match = constitutionResult.article_matches?.find(m => m.article_number === "18");
          assert.ok(article18Match, "article_matches should include Article 18");
        });

        it("should prioritize LPAC Article 14 for electronic administration obligation wording", () => {
          const queries = [
            "procedimiento administrativo obligados relacionarse electronicamente administracion",
            "derecho y obligacion comunicarse medios electronicos Ley 39 2015",
            "administraciones publicas medios electronicos personas fisicas juridicas",
          ];

          for (const query of queries) {
            const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);
            const lpacResult = results.find(r => r.citation.identifier === "BOE-A-2015-10565");
            assert.ok(lpacResult, `Results should include LPAC for query: ${query}`);
            assert.strictEqual(lpacResult.article_matches?.[0]?.article_number, "14", query);
            assert.strictEqual(lpacResult.next_tool?.arguments.article_number, "14", query);
          }
        });

        it("should route Civil Code Article 1101 for contractual damages queries", () => {
          const query = "responsabilidad contractual daños perjuicios incumplimiento";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

          assert.ok(results.length > 0, "Query should return at least one result");
          const civilCodeResult = results.find(r => r.citation.identifier === "BOE-A-1889-4763");
          assert.ok(civilCodeResult, "Results should include Civil Code (BOE-A-1889-4763)");
          assert.ok(civilCodeResult.article_matches, "Result should include article_matches");
          const article1101Match = civilCodeResult.article_matches?.find(m => m.article_number === "1101");
          assert.ok(article1101Match, "article_matches should include Article 1101");
        });

        it("should route Civil Code Article 1902 for non-contractual liability queries", () => {
          const query = "responsabilidad extracontractual culpa negligencia hecho";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

          assert.ok(results.length > 0, "Query should return at least one result");
          const civilCodeResult = results.find(r => r.citation.identifier === "BOE-A-1889-4763");
          assert.ok(civilCodeResult, "Results should include Civil Code (BOE-A-1889-4763)");
          assert.ok(civilCodeResult.article_matches, "Result should include article_matches");
          const article1902Match = civilCodeResult.article_matches?.find(m => m.article_number === "1902");
          assert.ok(article1902Match, "article_matches should include Article 1902");
        });

        it("should prioritize Civil Code Article 1902 for non-contractual damages wording", () => {
          const query = "responsabilidad civil extracontractual danos perjuicios Codigo Civil";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

          const civilCodeResult = results.find(r => r.citation.identifier === "BOE-A-1889-4763");
          assert.ok(civilCodeResult, "Results should include Civil Code (BOE-A-1889-4763)");
          assert.strictEqual(civilCodeResult.article_matches?.[0]?.article_number, "1902");
          assert.strictEqual(civilCodeResult.next_tool?.arguments.article_number, "1902");
        });

        it("should route Criminal Code Article 234 for theft queries", () => {
          const query = "robo hurto apropiacion ajena";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

          assert.ok(results.length > 0, "Query should return at least one result");
          const criminalCodeResult = results.find(r => r.citation.identifier === "BOE-A-1995-25444");
          assert.ok(criminalCodeResult, "Results should include Criminal Code (BOE-A-1995-25444)");
          assert.ok(criminalCodeResult.article_matches, "Result should include article_matches");
          const article234Match = criminalCodeResult.article_matches?.find(m => m.article_number === "234");
          assert.ok(article234Match, "article_matches should include Article 234");
        });

        it("should prioritize Criminal Code Article 234 for simple theft wording", () => {
          const query = "delito hurto tomar cosas muebles ajenas sin voluntad dueno";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

          const criminalCodeResult = results.find(r => r.citation.identifier === "BOE-A-1995-25444");
          assert.ok(criminalCodeResult, "Results should include Criminal Code (BOE-A-1995-25444)");
          assert.strictEqual(criminalCodeResult.article_matches?.[0]?.article_number, "234");
          assert.strictEqual(criminalCodeResult.next_tool?.arguments.article_number, "234");
        });

        it("should route Criminal Code Article 379 for drunk driving queries", () => {
          const query = "conduccion alcohol ebriedad alcoholemia vehiculo";
          const results = db.searchLaws(query, "es", undefined, undefined, undefined, undefined, 5);

          assert.ok(results.length > 0, "Query should return at least one result");
          const criminalCodeResult = results.find(r => r.citation.identifier === "BOE-A-1995-25444");
          assert.ok(criminalCodeResult, "Results should include Criminal Code (BOE-A-1995-25444)");
          assert.ok(criminalCodeResult.article_matches, "Result should include article_matches");
          const article379Match = criminalCodeResult.article_matches?.find(m => m.article_number === "379");
          assert.ok(article379Match, "article_matches should include Article 379");
        });
      });
    });
  });

  describe("reforms", () => {
    it("should insert and list reforms", () => {
      const reforms = [
        {
          law_identifier: "BOE-A-1889-4763",
          commit_sha: "abc123",
          date: "2025-01-01",
          source_id: "BOE-A-2025-0001",
          disposition_id: "BOE-A-2025-0001",
          affected_articles: ["1", "2"],
          summary: "Modificación del artículo 1",
          github_commit_url: "https://github.com/test/commit/abc123",
          source_url: "https://www.boe.es/test",
        },
        {
          law_identifier: "BOE-A-1889-4763",
          commit_sha: "def456",
          date: "2025-02-01",
          source_id: null,
          disposition_id: null,
          affected_articles: null,
          summary: "Actualización general",
          github_commit_url: "https://github.com/test/commit/def456",
          source_url: null,
        },
      ];

      db.insertReforms(reforms);

      const listed = db.listReforms("BOE-A-1889-4763");
      assert.strictEqual(listed.length, 2);
      assert.strictEqual(listed[0].commit_sha, "def456"); // Most recent first
      assert.strictEqual(listed[1].commit_sha, "abc123");
    });

    it("should filter reforms by date range", () => {
      const reforms = db.listReforms("BOE-A-1889-4763", "2025-01-15", "2025-02-15");
      assert.strictEqual(reforms.length, 1);
      assert.strictEqual(reforms[0].commit_sha, "def456");
    });

    it("should handle nullable affected_articles", () => {
      const reforms = db.listReforms("BOE-A-1889-4763");
      const reformWithNull = reforms.find((r) => r.affected_articles === null);
      assert.ok(reformWithNull);
    });

    it("should respect limit", () => {
      const reforms = db.listReforms("BOE-A-1889-4763", undefined, undefined, 1);
      assert.strictEqual(reforms.length, 1);
    });
  });

  describe("statistics", () => {
    it("should return database statistics", () => {
      const stats = db.getStats();
      assert.ok(stats.lawCount > 0);
      assert.ok(stats.articleCount > 0);
      assert.ok(stats.reformCount > 0);
    });
  });
});
