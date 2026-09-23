import { createExecutionContext, env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleRequest } from "../src/index";

const config = {
  ...env,
  XAI_BASE_URL: "https://api.example.test/v1",
  XAI_MODEL: "test-model",
  XAI_API_KEY: "test-key",
};

function rpc(path: string, method: string, params: Record<string, unknown> = {}, bindings = config) {
  return handleRequest(
    new Request("https://x-search.test" + path, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
    bindings,
    createExecutionContext(),
  );
}

async function result(response: Response) {
  const body = await response.text();
  const dataLine = body.split("\n").find((line) => line.startsWith("data: "));
  return JSON.parse(dataLine ? dataLine.slice(6) : body);
}

afterEach(() => vi.restoreAllMocks());

describe("Streamable HTTP MCP", () => {
  it("uses /mcp when SECRET_PATH is absent", async () => {
    const response = await rpc("/mcp", "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    expect(response.status).toBe(200);
    expect((await result(response)).result.serverInfo.name).toBe("x-search");
  });

  it("hides the endpoint at the configured path and preserves the search tool", async () => {
    const bindings = { ...config, SECRET_PATH: " sample-secret " };
    const root = await handleRequest(
      new Request("https://x-search.test/"),
      bindings,
      createExecutionContext(),
    );
    expect(await root.json()).toEqual({ name: "x-search-mcp", status: "ok" });

    for (const path of ["/mcp", "/wrong/mcp", "/sample-secret/mcp-extra"]) {
      expect((await rpc(path, "tools/list", {}, bindings)).status).toBe(404);
    }

    const listed = await rpc("/sample-secret/mcp", "tools/list", {}, bindings);
    expect(listed.status).toBe(200);
    expect((await result(listed)).result.tools.map((tool: { name: string }) => tool.name)).toEqual(["search"]);

    const mockedFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "a result" }] }] }),
    );
    const called = await rpc("/sample-secret/mcp/", "tools/call", {
      name: "search",
      arguments: { query: "find a post" },
    }, bindings);
    expect(called.status).toBe(200);
    expect((await result(called)).result.content[0].text).toBe("a result");
    expect(mockedFetch).toHaveBeenCalledOnce();
    expect(mockedFetch.mock.calls[0]?.[0]).toBe("https://api.example.test/v1/responses");
    const requestInit = mockedFetch.mock.calls[0]?.[1];
    expect(requestInit?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer test-key" }));
  });
});
