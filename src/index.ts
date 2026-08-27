import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { runXSearch, UpstreamError, type XSearchInput } from "./xai";

type Env = {
  XAI_BASE_URL?: string;
  XAI_MODEL?: string;
  XAI_API_KEY?: string;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const handles = z.array(z.string().min(1)).max(20);

function requireConfig(env: Env) {
  const baseUrl = env.XAI_BASE_URL?.trim();
  const model = env.XAI_MODEL?.trim();
  const apiKey = env.XAI_API_KEY?.trim();

  if (!baseUrl) throw new Error("XAI_BASE_URL is required");
  if (!model) throw new Error("XAI_MODEL is required");
  if (!apiKey) throw new Error("XAI_API_KEY is required");

  return { baseUrl, model, apiKey };
}

function createServer(env: Env) {
  const server = new McpServer({ name: "x-search", version: "0.1.0" });

  server.registerTool(
    "search",
    {
      description: "Search X/Twitter using xAI's server-side x_search tool.",
      inputSchema: {
        query: z.string().min(1).describe("What to search for on X."),
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
            content: [{ type: "text" as const, text: error.body || `HTTP ${error.status}` }],
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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, server: "x-search" });
    }

    if (url.pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }

    const handler = createMcpHandler(() => createServer(env), { route: "/mcp" });
    return handler(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
