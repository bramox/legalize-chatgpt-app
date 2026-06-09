import { describe, it } from "node:test";
import assert from "node:assert";
import {
  isValidJurisdiction,
  isValidDate,
  isValidIdentifier,
  isValidArticleNumber,
  isValidQuery,
  validateLimit,
  validateMaxChars,
  SUPPORTED_JURISDICTIONS,
} from "../../src/tools/schemas.js";

describe("Tool Schemas", () => {
  describe("isValidJurisdiction", () => {
    it("should accept valid jurisdictions", () => {
      assert.strictEqual(isValidJurisdiction("es"), true);
      assert.strictEqual(isValidJurisdiction("es-ct"), true);
      assert.strictEqual(isValidJurisdiction("es-an"), true);
    });

    it("should reject invalid jurisdictions", () => {
      assert.strictEqual(isValidJurisdiction("fr"), false);
      assert.strictEqual(isValidJurisdiction("es-invalid"), false);
      assert.strictEqual(isValidJurisdiction(""), false);
    });
  });

  describe("isValidDate", () => {
    it("should accept valid dates", () => {
      assert.strictEqual(isValidDate("2024-01-01"), true);
      assert.strictEqual(isValidDate("1889-07-25"), true);
      assert.strictEqual(isValidDate("2025-12-31"), true);
    });

    it("should reject invalid dates", () => {
      assert.strictEqual(isValidDate("2024-13-01"), false);
      assert.strictEqual(isValidDate("2024-01-32"), false);
      assert.strictEqual(isValidDate("01-01-2024"), false);
      assert.strictEqual(isValidDate("2024/01/01"), false);
      assert.strictEqual(isValidDate("invalid"), false);
    });
  });

  describe("isValidIdentifier", () => {
    it("should accept valid identifiers", () => {
      assert.strictEqual(isValidIdentifier("BOE-A-1889-4763"), true);
      assert.strictEqual(isValidIdentifier("ABC"), true);
      assert.strictEqual(isValidIdentifier("a".repeat(80)), true);
    });

    it("should reject invalid identifiers", () => {
      assert.strictEqual(isValidIdentifier("AB"), false);
      assert.strictEqual(isValidIdentifier(""), false);
      assert.strictEqual(isValidIdentifier("a".repeat(81)), false);
    });
  });

  describe("isValidArticleNumber", () => {
    it("should accept valid article numbers", () => {
      assert.strictEqual(isValidArticleNumber("1"), true);
      assert.strictEqual(isValidArticleNumber("2.1"), true);
      assert.strictEqual(isValidArticleNumber("Artículo 1"), true);
      assert.strictEqual(isValidArticleNumber("a".repeat(40)), true);
    });

    it("should reject invalid article numbers", () => {
      assert.strictEqual(isValidArticleNumber(""), false);
      assert.strictEqual(isValidArticleNumber("a".repeat(41)), false);
    });
  });

  describe("isValidQuery", () => {
    it("should accept valid queries", () => {
      assert.strictEqual(isValidQuery("test"), true);
      assert.strictEqual(isValidQuery("a".repeat(300)), true);
      assert.strictEqual(isValidQuery("civil code"), true);
    });

    it("should reject invalid queries", () => {
      assert.strictEqual(isValidQuery("a"), false);
      assert.strictEqual(isValidQuery(""), false);
      assert.strictEqual(isValidQuery("a".repeat(301)), false);
    });
  });

  describe("validateLimit", () => {
    it("should return default value when undefined", () => {
      assert.strictEqual(validateLimit(undefined, 1, 20, 10), 10);
    });

    it("should accept valid limits", () => {
      assert.strictEqual(validateLimit(5, 1, 20, 10), 5);
      assert.strictEqual(validateLimit(1, 1, 20, 10), 1);
      assert.strictEqual(validateLimit(20, 1, 20, 10), 20);
    });

    it("should throw error for invalid limits", () => {
      assert.throws(() => validateLimit(0, 1, 20, 10));
      assert.throws(() => validateLimit(21, 1, 20, 10));
    });
  });

  describe("validateMaxChars", () => {
    it("should return default value when undefined", () => {
      assert.strictEqual(validateMaxChars(undefined, 1000, 30000, 12000), 12000);
    });

    it("should accept valid max_chars", () => {
      assert.strictEqual(validateMaxChars(5000, 1000, 30000, 12000), 5000);
      assert.strictEqual(validateMaxChars(1000, 1000, 30000, 12000), 1000);
      assert.strictEqual(validateMaxChars(30000, 1000, 30000, 12000), 30000);
    });

    it("should throw error for invalid max_chars", () => {
      assert.throws(() => validateMaxChars(999, 1000, 30000, 12000));
      assert.throws(() => validateMaxChars(30001, 1000, 30000, 12000));
    });
  });

  describe("SUPPORTED_JURISDICTIONS", () => {
    it("should contain all expected jurisdictions", () => {
      assert.ok(SUPPORTED_JURISDICTIONS.includes("es"));
      assert.ok(SUPPORTED_JURISDICTIONS.includes("es-ct"));
      assert.ok(SUPPORTED_JURISDICTIONS.includes("es-an"));
      assert.strictEqual(SUPPORTED_JURISDICTIONS.length, 18);
    });
  });
});
