import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  handleSearchLaws,
  handleGetLawMetadata,
  handleGetArticle,
  handleGetLawExcerpt,
  handleListReforms,
} from "../../src/tools/handlers.js";
import { createTempDir, cleanupTempDir, buildMinimalTestDatabase } from "../helpers/setup.js";

describe("Tool Handlers", () => {
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

  describe("handleSearchLaws", () => {
    it("should search laws successfully", async () => {
      const result = await handleSearchLaws(db, {
        query: "civil",
        limit: 10,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(Array.isArray(result.results));
        assert.strictEqual(result.next_cursor, null);
      }
    });

    it("should reject invalid query", async () => {
      const result = await handleSearchLaws(db, {
        query: "a", // Too short
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "invalid_input");
      }
    });

    it("should reject unsupported jurisdiction", async () => {
      const result = await handleSearchLaws(db, {
        query: "test",
        jurisdiction: "fr" as any,
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "unsupported_jurisdiction");
      }
    });

    it("should reject invalid date format", async () => {
      const result = await handleSearchLaws(db, {
        query: "test",
        date_from: "invalid",
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "invalid_input");
      }
    });
  });

  describe("handleGetLawMetadata", () => {
    it("should get law metadata successfully", async () => {
      const result = await handleGetLawMetadata(db, {
        identifier: "BOE-A-1889-4763",
      });

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(result.citation);
        assert.ok(result.metadata);
        assert.strictEqual(result.citation.identifier, "BOE-A-1889-4763");
      }
    });

    it("should reject invalid identifier", async () => {
      const result = await handleGetLawMetadata(db, {
        identifier: "AB", // Too short
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "invalid_input");
      }
    });

    it("should return unknown_law for non-existent law", async () => {
      const result = await handleGetLawMetadata(db, {
        identifier: "BOE-A-0000-0000",
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "unknown_law");
      }
    });
  });

  describe("handleGetArticle", () => {
    it("should get article successfully", async () => {
      const result = await handleGetArticle(db, {
        identifier: "BOE-A-1889-4763",
        article_number: "1",
      });

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(result.citation);
        assert.ok(result.article);
        assert.strictEqual(result.article.article_number, "1");
        assert.ok(result.article.text.length > 0);
      }
    });

    it("should reject invalid article number", async () => {
      const result = await handleGetArticle(db, {
        identifier: "BOE-A-1889-4763",
        article_number: "", // Too short
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "invalid_input");
      }
    });

    it("should return unknown_article for non-existent article", async () => {
      const result = await handleGetArticle(db, {
        identifier: "BOE-A-1889-4763",
        article_number: "999",
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "unknown_article");
      }
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

      it("AC3: get_article should succeed with stable identifier and valid article number", async () => {
        const result = await handleGetArticle(db, {
          identifier: "BOE-A-2007-13409",
          article_number: "38 ter",
        });

        assert.strictEqual(result.ok, true);
        if (result.ok) {
          assert.strictEqual(result.citation.identifier, "BOE-A-2007-13409");
          assert.strictEqual(result.article.article_number, "38 ter");
          assert.ok(result.article.text.length > 0);
        }
      });

      it("AC3-variant-1: get_article should succeed with 'Artículo 38 ter' (capitalized with article label)", async () => {
        const result = await handleGetArticle(db, {
          identifier: "BOE-A-2007-13409",
          article_number: "Artículo 38 ter",
        });

        assert.strictEqual(result.ok, true);
        if (result.ok) {
          assert.strictEqual(result.citation.identifier, "BOE-A-2007-13409");
          assert.strictEqual(result.article.article_number, "38 ter");
          assert.ok(result.article.text.length > 0);
        }
      });

      it("AC3-variant-2: get_article should succeed with 'artículo 38 ter' (lowercase with article label)", async () => {
        const result = await handleGetArticle(db, {
          identifier: "BOE-A-2007-13409",
          article_number: "artículo 38 ter",
        });

        assert.strictEqual(result.ok, true);
        if (result.ok) {
          assert.strictEqual(result.citation.identifier, "BOE-A-2007-13409");
          assert.strictEqual(result.article.article_number, "38 ter");
          assert.ok(result.article.text.length > 0);
        }
      });

      it("AC3-variant-3: get_article should succeed with 'art. 38 ter' (abbreviation)", async () => {
        const result = await handleGetArticle(db, {
          identifier: "BOE-A-2007-13409",
          article_number: "art. 38 ter",
        });

        assert.strictEqual(result.ok, true);
        if (result.ok) {
          assert.strictEqual(result.citation.identifier, "BOE-A-2007-13409");
          assert.strictEqual(result.article.article_number, "38 ter");
          assert.ok(result.article.text.length > 0);
        }
      });

      it("AC3-variant-4: get_article should succeed with '38ter' (no space)", async () => {
        const result = await handleGetArticle(db, {
          identifier: "BOE-A-2007-13409",
          article_number: "38ter",
        });

        assert.strictEqual(result.ok, true);
        if (result.ok) {
          assert.strictEqual(result.citation.identifier, "BOE-A-2007-13409");
          assert.strictEqual(result.article.article_number, "38 ter");
          assert.ok(result.article.text.length > 0);
        }
      });

      it("AC3-variant-5: get_article should handle legacy malformed '38 ' (trailing space)", async () => {
        const result = await handleGetArticle(db, {
          identifier: "BOE-A-2007-13409",
          article_number: "38 ",
        });

        // Legacy malformed handling: "38 " (with trailing space) should recover to canonical "38 ter"
        // This is now deterministic with the safe fallback that requires trailing space as a malformed indicator
        assert.strictEqual(result.ok, true);
        if (result.ok) {
          assert.strictEqual(result.citation.identifier, "BOE-A-2007-13409");
          assert.strictEqual(result.article.article_number, "38 ter");
          assert.ok(result.article.text.length > 0);
        }
      });

      it("AC4: get_article with non-stable identifier should return structured unknown_law error with candidates", async () => {
        const result = await handleGetArticle(db, {
          identifier: "Real Decreto Legislativo 8/2015",
          article_number: "38 ter",
        });

        assert.strictEqual(result.ok, false);
        if (!result.ok) {
          assert.strictEqual(result.error.code, "unknown_law");
          // Should include candidate law identifiers when matching law metadata exists
          assert.ok(result.error.details?.candidates, "Error should include candidate law identifiers");
        }
      });

      it("AC5: get_article with valid identifier and missing article should return unknown_article with suggestions", async () => {
        const result = await handleGetArticle(db, {
          identifier: "BOE-A-2015-11724",
          article_number: "38 ter",
        });

        assert.strictEqual(result.ok, false);
        if (!result.ok) {
          assert.strictEqual(result.error.code, "unknown_article");
          // Should include nearby article suggestions when available
          assert.ok(result.error.details?.suggestions, "Error should include article suggestions");
        }
      });

      it("AC6: get_article should not fabricate matches for mismatched law/article pairs", async () => {
        const result = await handleGetArticle(db, {
          identifier: "BOE-A-2015-11724",
          article_number: "38 ter",
        });

        assert.strictEqual(result.ok, false);
        if (!result.ok) {
          assert.strictEqual(result.error.code, "unknown_article");
          // Should not return Article 38 ter from Ley 20/2007
          // This test verifies the negative case
          assert.ok(!result.ok, "Should not succeed for mismatched law/article pair");
        }
      });
    });
  });

  describe("handleGetLawExcerpt", () => {
    it("should get excerpts successfully", async () => {
      const result = await handleGetLawExcerpt(db, {
        identifier: "BOE-A-1889-4763",
        query: "fuentes",
      });

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(result.citation);
        assert.ok(Array.isArray(result.excerpts));
      }
    });

    it("should reject invalid query", async () => {
      const result = await handleGetLawExcerpt(db, {
        identifier: "BOE-A-1889-4763",
        query: "a", // Too short
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "invalid_input");
      }
    });

    it("should return unknown_law for non-existent law", async () => {
      const result = await handleGetLawExcerpt(db, {
        identifier: "BOE-A-0000-0000",
        query: "test",
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "unknown_law");
      }
    });
  });

  describe("handleListReforms", () => {
    it("should list reforms successfully", async () => {
      const result = await handleListReforms(db, {
        identifier: "BOE-A-1889-4763",
      });

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(result.citation);
        assert.ok(Array.isArray(result.reforms));
        assert.strictEqual(result.next_cursor, null);
      }
    });

    it("should reject invalid date format", async () => {
      const result = await handleListReforms(db, {
        identifier: "BOE-A-1889-4763",
        date_from: "invalid",
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error.code, "invalid_input");
      }
    });
  });
});
