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
