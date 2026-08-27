#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

import { runXSearch, UpstreamError, type XSearchInput } from "./xai.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const handles = z.array(z.string().min(1)).max(20);

function requireConfig() {
  const baseUrl = process.env.XAI_BASE_URL?.trim();
  const model = process.env.XAI_MODEL?.trim();
  const apiKey = process.env.XAI_API_KEY?.trim();

  if (!baseUrl) throw new Error("XAI_BASE_URL is required");
  if (!model) throw new Error("XAI_MODEL is required");
  if (!apiKey) throw new Error("XAI_API_KEY is required");

  return { baseUrl, model, apiKey };
}

function createServer() {
  const server = new McpServer({ name: "x-search", version: "0.2.0" });

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
        const text = await runXSearch(args as XSearchInput, requireConfig());
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

serveStdio(createServer, {
  onerror(error) {
    console.error(error);
  },
});
