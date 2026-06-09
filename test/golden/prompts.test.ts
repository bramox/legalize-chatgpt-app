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
