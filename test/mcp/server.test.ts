import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { createMcpServer } from "../../src/mcp/server.js";
import { config } from "../../src/config.js";
import { cleanupTempDir, buildMinimalTestDatabase, createTempDir } from "../helpers/setup.js";

describe("MCP Server", () => {
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

  describe("Spanish Law Research Regression", () => {
    let spanishTempDir: string;
    let spanishDb: Awaited<ReturnType<typeof buildMinimalTestDatabase>>;

    before(async () => {
      spanishTempDir = await createTempDir();
      spanishDb = await buildMinimalTestDatabase(spanishTempDir);

      const { readFixture, parseLawFile } = await import("../helpers/setup.js");

      const ley2007Content = await readFixture("legalize-es/es/BOE-A-2007-13409.md");
      const ley2007Parsed = parseLawFile(ley2007Content, "es/BOE-A-2007-13409.md", "test-revision-sha");
      spanishDb.upsertLaw(ley2007Parsed.law);
      spanishDb.insertArticleChunks(ley2007Parsed.chunks);

      const rdl2015Content = await readFixture("legalize-es/es/BOE-A-2015-11724.md");
      const rdl2015Parsed = parseLawFile(rdl2015Content, "es/BOE-A-2015-11724.md", "test-revision-sha");
      spanishDb.upsertLaw(rdl2015Parsed.law);
      spanishDb.insertArticleChunks(rdl2015Parsed.chunks);
    });

    after(async () => {
      spanishDb.close();
      await cleanupTempDir(spanishTempDir);
    });

    it("returns unknown_article with suggestions for missing article number", async () => {
      const server = createMcpServer(spanishDb);
      const client = new Client({
        name: "test-client",
        version: "0.0.0",
      });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      try {
        const result = await client.callTool({
          name: "get_article",
          arguments: {
            identifier: "BOE-A-2015-11724",
            article_number: "999999",
          },
        });

        assert.strictEqual(result.isError, true);
        const structuredContent = result.structuredContent as Record<string, unknown>;
        assert.strictEqual(structuredContent.ok, false);
        assert.strictEqual(
          (structuredContent.error as Record<string, unknown>).code,
          "unknown_article",
        );
        assert.ok(
          (structuredContent.error as Record<string, unknown>).details,
          "Error should include details",
        );
        const details = (structuredContent.error as Record<string, unknown>).details as Record<string, unknown>;
        assert.ok(details.suggestions, "Details should include suggestions array");
        assert.ok(Array.isArray(details.suggestions), "suggestions should be an array");
      } finally {
        await client.close();
        await server.close();
      }
    });

    it("returns unknown_law with candidates for non-stable identifier", async () => {
      const server = createMcpServer(spanishDb);
      const client = new Client({
        name: "test-client",
        version: "0.0.0",
      });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      try {
        const result = await client.callTool({
          name: "get_article",
          arguments: {
            identifier: "Real Decreto Legislativo 8/2015",
            article_number: "38 ter",
          },
        });

        assert.strictEqual(result.isError, true);
        const structuredContent = result.structuredContent as Record<string, unknown>;
        assert.strictEqual(structuredContent.ok, false);
        assert.strictEqual(
          (structuredContent.error as Record<string, unknown>).code,
          "unknown_law",
        );
        assert.ok(
          (structuredContent.error as Record<string, unknown>).details,
          "Error should include details",
        );
        const details = (structuredContent.error as Record<string, unknown>).details as Record<string, unknown>;
        assert.ok(details.candidates, "Details should include candidates array");
        assert.ok(Array.isArray(details.candidates), "candidates should be an array");
      } finally {
        await client.close();
        await server.close();
      }
    });
  });

  it("registers five read-only tools without UI resources", async () => {
    const { client, server } = await connectTestClient();

    try {
      const result = await client.listTools();
      assert.strictEqual(result.tools.length, 5);

      const names = result.tools.map((tool) => tool.name).sort();
      assert.deepStrictEqual(names, [
        "get_article",
        "get_law_excerpt",
        "get_law_metadata",
        "list_reforms",
        "search_laws",
      ]);

      for (const tool of result.tools) {
        assert.strictEqual(tool.annotations?.readOnlyHint, true);
        assert.strictEqual(tool.annotations?.destructiveHint, false);
        assert.ok(tool.inputSchema);
        assert.ok(tool.outputSchema);
        assert.deepStrictEqual(tool._meta?.ui, { visibility: ["model"] });
        assert.strictEqual((tool._meta?.ui as Record<string, unknown>).resourceUri, undefined);
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns structured content for successful tool calls", async () => {
    const { client, server } = await connectTestClient();

    try {
      const result = await client.callTool({
        name: "get_law_metadata",
        arguments: {
          identifier: "BOE-A-1889-4763",
        },
      });

      assert.strictEqual(result.isError, undefined);
      const structuredContent = result.structuredContent as Record<string, unknown>;
      assert.ok(structuredContent);
      assert.strictEqual(structuredContent.ok, true);
      assert.strictEqual(
        (structuredContent.citation as Record<string, unknown>).identifier,
        "BOE-A-1889-4763",
      );
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns structured business errors for failed tool calls", async () => {
    const { client, server } = await connectTestClient();

    try {
      const result = await client.callTool({
        name: "get_article",
        arguments: {
          identifier: "BOE-A-1889-4763",
          article_number: "999999",
        },
      });

      assert.strictEqual(result.isError, true);
      const structuredContent = result.structuredContent as Record<string, unknown>;
      assert.ok(structuredContent);
      assert.strictEqual(structuredContent.ok, false);
      assert.strictEqual(
        (structuredContent.error as Record<string, unknown>).code,
        "unknown_article",
      );
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns limit_exceeded when the structured response is too large", async () => {
    const originalMaxResponseSizeBytes = config.maxResponseSizeBytes;
    (config as { maxResponseSizeBytes: number }).maxResponseSizeBytes = 200;
    const { client, server } = await connectTestClient();

    try {
      const result = await client.callTool({
        name: "get_article",
        arguments: {
          identifier: "BOE-A-1889-4763",
          article_number: "1",
          max_chars: 1000,
        },
      });

      const structuredContent = result.structuredContent as Record<string, unknown>;
      assert.strictEqual(result.isError, true);
      assert.strictEqual(structuredContent.ok, false);
      assert.strictEqual(
        (structuredContent.error as Record<string, unknown>).code,
        "limit_exceeded",
      );
    } finally {
      (config as { maxResponseSizeBytes: number }).maxResponseSizeBytes =
        originalMaxResponseSizeBytes;
      await client.close();
      await server.close();
    }
  });

  async function connectTestClient() {
    const server = createMcpServer(db);
    const client = new Client({
      name: "test-client",
      version: "0.0.0",
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    return { client, server };
  }
});
