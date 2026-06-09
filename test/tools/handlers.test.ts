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
