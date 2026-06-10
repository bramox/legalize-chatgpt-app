import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createTempDir, cleanupTempDir, buildMinimalTestDatabase } from "../helpers/setup.js";

describe("Golden Prompt Routing", () => {
  let tempDir: string;
  let db: Awaited<ReturnType<typeof buildMinimalTestDatabase>>;

  before(async () => {
    tempDir = await createTempDir();
    db = await buildMinimalTestDatabase(tempDir);
  });

  after(async () => {
    db.close();
    await cleanupTempDir(tempDir);
  });

  describe("Spanish Law Research Bug Reproduction", () => {
    before(async () => {
      // Load the Spanish law fixtures for testing
      const { readFixture, parseLawFile } = await import("../helpers/setup.js");

      // Load Ley 20/2007
      const ley2007Content = await readFixture("legalize-es/es/BOE-A-2007-13409.md");
      const ley2007Parsed = parseLawFile(ley2007Content, "es/BOE-A-2007-13409.md", "test-revision-sha");
      db.upsertLaw(ley2007Parsed.law);
      db.insertArticleChunks(ley2007Parsed.chunks);

      // Load Real Decreto Legislativo 8/2015
      const rdl2015Content = await readFixture("legalize-es/es/BOE-A-2015-11724.md");
      const rdl2015Parsed = parseLawFile(rdl2015Content, "es/BOE-A-2015-11724.md", "test-revision-sha");
      db.upsertLaw(rdl2015Parsed.law);
      db.insertArticleChunks(rdl2015Parsed.chunks);
    });

    it("should route long Spanish legal query about reduced contribution regime", async () => {
      const { handleSearchLaws } = await import("../../src/tools/handlers.js");

      const result = await handleSearchLaws(db, {
        query: "cuota reducida autonomos segundo año rendimientos netos inferiores salario mínimo interprofesional artículo 38 ter LGSS",
        jurisdiction: "es",
        limit: 10,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(Array.isArray(result.results));
        const ley2007Result = result.results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Results should include Ley 20/2007 (BOE-A-2007-13409)");
      }
    });

    it("should route Russian natural-language question about autónomo contribution via search_laws first then get_article", async () => {
      const { handleSearchLaws, handleGetArticle } = await import("../../src/tools/handlers.js");

      const searchResult = await handleSearchLaws(db, {
        query: "cuota reducida trabajadores autónomos segundo año",
        jurisdiction: "es",
        limit: 10,
      });

      assert.strictEqual(searchResult.ok, true);
      if (searchResult.ok) {
        const ley2007Result = searchResult.results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Search should find Ley 20/2007");

        assert.ok(ley2007Result.article_matches, "Result should include article_matches");
        assert.ok(ley2007Result.article_matches.length > 0, "article_matches should have entries");

        assert.ok(ley2007Result.next_tool, "Result should include next_tool");
        assert.strictEqual(ley2007Result.next_tool.name, "get_article");

        const articleResult = await handleGetArticle(db, {
          identifier: ley2007Result.next_tool.arguments.identifier,
          article_number: ley2007Result.next_tool.arguments.article_number,
          jurisdiction: ley2007Result.next_tool.arguments.jurisdiction,
        });

        assert.strictEqual(articleResult.ok, true);
        if (articleResult.ok) {
          assert.ok(articleResult.article);
          assert.strictEqual(articleResult.article.article_number, ley2007Result.next_tool.arguments.article_number);
        }
      }
    });

    it("should use article_matches for search-to-article routing", async () => {
      const { handleSearchLaws, handleGetArticle } = await import("../../src/tools/handlers.js");

      const searchResult = await handleSearchLaws(db, {
        query: "cuota reducida trabajadores autónomos segundo año",
        jurisdiction: "es",
        limit: 10,
      });

      assert.strictEqual(searchResult.ok, true);
      if (searchResult.ok) {
        const ley2007Result = searchResult.results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Search should find Ley 20/2007");

        // Demonstrate using citation.identifier and article_matches[0].article_number for get_article
        assert.ok(ley2007Result.article_matches, "Result should include article_matches");
        assert.ok(ley2007Result.article_matches.length > 0, "article_matches should have entries");

        const firstMatch = ley2007Result.article_matches[0];
        const articleResult = await handleGetArticle(db, {
          identifier: ley2007Result.citation.identifier,
          article_number: firstMatch.article_number,
        });

        assert.strictEqual(articleResult.ok, true);
        if (articleResult.ok) {
          assert.ok(articleResult.article);
          assert.strictEqual(articleResult.article.article_number, firstMatch.article_number);
        }
      }
    });

    it("should route alternative Spanish legal query about reduced contribution", async () => {
      const { handleSearchLaws } = await import("../../src/tools/handlers.js");

      const result = await handleSearchLaws(db, {
        query: "tarifa plana cuota reducida trabajadores autónomos segundo periodo rendimientos económicos netos salario mínimo interprofesional",
        jurisdiction: "es",
        limit: 10,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(Array.isArray(result.results));
        const ley2007Result = result.results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Results should include Ley 20/2007 (BOE-A-2007-13409)");
      }
    });

    it("should route direct article lookup with stable identifier", async () => {
      const { handleGetArticle } = await import("../../src/tools/handlers.js");

      const result = await handleGetArticle(db, {
        identifier: "BOE-A-2007-13409",
        article_number: "38 ter",
      });

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(result.article);
        assert.strictEqual(result.article.article_number, "38 ter");
      }
    });

    it("should resolve natural-language law label through search before article retrieval", async () => {
      const { handleSearchLaws, handleGetArticle } = await import("../../src/tools/handlers.js");

      const searchResult = await handleSearchLaws(db, {
        query: "Ley 20/2007",
        jurisdiction: "es",
        limit: 5,
      });

      assert.strictEqual(searchResult.ok, true);
      if (searchResult.ok) {
        assert.ok(Array.isArray(searchResult.results));
        const ley2007Result = searchResult.results.find(r => r.citation.identifier === "BOE-A-2007-13409");
        assert.ok(ley2007Result, "Search should find Ley 20/2007");

        const articleResult = await handleGetArticle(db, {
          identifier: ley2007Result.citation.identifier,
          article_number: "38 ter",
        });

        assert.strictEqual(articleResult.ok, true);
        if (articleResult.ok) {
          assert.ok(articleResult.article);
          assert.strictEqual(articleResult.article.article_number, "38 ter");
        }
      }
    });

    it("should return structured error for mismatched law and article pair", async () => {
      const { handleGetArticle } = await import("../../src/tools/handlers.js");

      const result = await handleGetArticle(db, {
        identifier: "Real Decreto Legislativo 8/2015",
        article_number: "38 ter",
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "unknown_law");
        assert.ok(result.error.details.candidates, "Error should include candidate laws");
        assert.ok(Array.isArray(result.error.details.candidates), "candidates should be an array");
      }
    });
  });

  describe("Search Prompts", () => {
    it("should route search for law topic queries", async () => {
      const { handleSearchLaws } = await import("../../src/tools/handlers.js");
      
      const result = await handleSearchLaws(db, {
        query: "civil code",
        limit: 10,
      });
      
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(Array.isArray(result.results));
      }
    });

    it("should route search with jurisdiction filter", async () => {
      const { handleSearchLaws } = await import("../../src/tools/handlers.js");
      
      const result = await handleSearchLaws(db, {
        query: "law",
        jurisdiction: "es",
        limit: 5,
      });
      
      assert.strictEqual(result.ok, true);
    });
  });

  describe("Article Retrieval Prompts", () => {
    it("should route article retrieval by identifier and number", async () => {
      const { handleGetArticle } = await import("../../src/tools/handlers.js");
      
      const result = await handleGetArticle(db, {
        identifier: "BOE-A-1889-4763",
        article_number: "1",
      });
      
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(result.article);
        assert.strictEqual(result.article.article_number, "1");
        assert.ok(result.article.text.length > 0);
      }
    });

    it("should route article retrieval with max_chars", async () => {
      const { handleGetArticle } = await import("../../src/tools/handlers.js");
      
      const result = await handleGetArticle(db, {
        identifier: "BOE-A-1889-4763",
        article_number: "1",
        max_chars: 5000,
      });
      
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(result.article.text.length <= 5000);
      }
    });
  });

  describe("Excerpt Prompts", () => {
    it("should route excerpt search within a law", async () => {
      const { handleGetLawExcerpt } = await import("../../src/tools/handlers.js");
      
      const result = await handleGetLawExcerpt(db, {
        identifier: "BOE-A-1889-4763",
        query: "fuentes del ordenamiento",
      });
      
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(Array.isArray(result.excerpts));
      }
    });
  });

  describe("Reform History Prompts", () => {
    it("should route reform history requests", async () => {
      const { handleListReforms } = await import("../../src/tools/handlers.js");
      
      const result = await handleListReforms(db, {
        identifier: "BOE-A-1889-4763",
      });
      
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(Array.isArray(result.reforms));
      }
    });
  });
  describe("Ambiguous/Invalid Prompts", () => {
    it("should handle unsupported jurisdiction with error", async () => {
      const { handleSearchLaws } = await import("../../src/tools/handlers.js");
      
      const result = await handleSearchLaws(db, {
        query: "law",
        jurisdiction: "fr" as any,
      });
      
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "unsupported_jurisdiction");
      }
    });

    it("should handle invalid identifier with error", async () => {
      const { handleGetLawMetadata } = await import("../../src/tools/handlers.js");
      
      const result = await handleGetLawMetadata(db, {
        identifier: "AB",
      });
      
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "invalid_input");
      }
    });

    it("should handle unknown law with error", async () => {
      const { handleGetLawMetadata } = await import("../../src/tools/handlers.js");
      
      const result = await handleGetLawMetadata(db, {
        identifier: "BOE-A-0000-0000",
      });
      
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "unknown_law");
      }
    });

    it("should handle unknown article with error", async () => {
      const { handleGetArticle } = await import("../../src/tools/handlers.js");
      
      const result = await handleGetArticle(db, {
        identifier: "BOE-A-1889-4763",
        article_number: "999",
      });
      
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "unknown_article");
      }
    });
  });

  describe("Response Bounds", () => {
    it("should enforce max_chars on article retrieval", async () => {
      const { handleGetArticle } = await import("../../src/tools/handlers.js");
      
      const result = await handleGetArticle(db, {
        identifier: "BOE-A-1889-4763",
        article_number: "1",
        max_chars: 1000,
      });
      
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(result.article.text.length <= 1000);
      }
    });

    it("should enforce limit on search results", async () => {
      const { handleSearchLaws } = await import("../../src/tools/handlers.js");
      
      const result = await handleSearchLaws(db, {
        query: "law",
        limit: 5,
      });
      
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(result.results.length <= 5);
      }
    });
  });
});
