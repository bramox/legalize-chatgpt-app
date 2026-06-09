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

  it("registers six read-only tools without UI resources", async () => {
    const { client, server } = await connectTestClient();

    try {
      const result = await client.listTools();
      assert.strictEqual(result.tools.length, 6);

      const names = result.tools.map((tool) => tool.name).sort();
      assert.deepStrictEqual(names, [
        "compare_reform",
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
        name: "compare_reform",
        arguments: {
          identifier: "BOE-A-1889-4763",
          base_revision: "abc123456789",
          target_revision: "def123456789",
        },
      });

      assert.strictEqual(result.isError, true);
      const structuredContent = result.structuredContent as Record<string, unknown>;
      assert.ok(structuredContent);
      assert.strictEqual(structuredContent.ok, false);
      assert.strictEqual(
        (structuredContent.error as Record<string, unknown>).code,
        "source_unavailable",
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
