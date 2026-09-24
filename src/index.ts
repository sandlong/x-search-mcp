import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { runXSearch, UpstreamError, type XSearchInput } from "./xai.js";

type WorkerEnv = {
  XAI_BASE_URL: string;
  XAI_MODEL: string;
  XAI_API_KEY: string;
  SECRET_PATH?: string;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const handles = z.array(z.string().min(1)).max(20);

function requireConfig(env: WorkerEnv) {
  const baseUrl = env.XAI_BASE_URL?.trim();
  const model = env.XAI_MODEL?.trim();
  const apiKey = env.XAI_API_KEY?.trim();

  if (!baseUrl) throw new Error("XAI_BASE_URL is required");
  if (!model) throw new Error("XAI_MODEL is required");
  if (!apiKey) throw new Error("XAI_API_KEY is required");

  return { baseUrl, model, apiKey };
}

function createServer(env: WorkerEnv) {
  const server = new McpServer({ name: "x-search", version: "0.3.0" });

  server.registerTool(
    "search",
    {
      description: "Search and read X/Twitter using xAI's LLM-based x_search tool.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            'Semantic search, or give X post URLs, handles, or status IDs with natural-language instructions such as "no summarization", "read the important replies", or "give the thread verbatim".',
          ),
        allowed_x_handles: handles
          .optional()
          .describe("Optional allow-list of X handles, without @. Max 20. Do not use with excluded_x_handles."),
        excluded_x_handles: handles
          .optional()
          .describe("Optional deny-list of X handles, without @. Max 20. Do not use with allowed_x_handles."),
        from_date: isoDate.optional().describe("Optional inclusive start date in YYYY-MM-DD format."),
        to_date: isoDate.optional().describe("Optional inclusive end date in YYYY-MM-DD format."),
        enable_image_understanding: z
          .boolean()
          .default(true)
          .describe("Allow xAI to understand images found in X posts. Defaults to true."),
        enable_video_understanding: z
          .boolean()
          .default(true)
          .describe("Allow xAI to understand videos found in X posts. Defaults to true."),
      },
    },
    async (args) => {
      try {
        const text = await runXSearch(args as XSearchInput, requireConfig(env));
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        if (error instanceof UpstreamError) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: error.body || "HTTP " + error.status }],
          };
        }
        return {
          isError: true,
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
        };
      }
    },
  );

  return server;
}

export function handleRequest(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
  const url = new URL(request.url);
  const secretPath = (env.SECRET_PATH ?? "").trim().replace(/^\/+|\/+$/g, "");
  const mcpPath = secretPath ? "/" + secretPath + "/mcp" : "/mcp";

  if (url.pathname === mcpPath || url.pathname === mcpPath + "/") {
    return createMcpHandler(() => createServer(env), { route: url.pathname })(request, env, ctx);
  }
  if (url.pathname === "/") {
    return Response.json({ name: "x-search-mcp", status: "ok" });
  }
  return new Response("Not found", { status: 404 });
}

export default { fetch: handleRequest } satisfies ExportedHandler<WorkerEnv>;
