import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildResponsesBody,
  extractOutputText,
  normalizeResponsesUrl,
  runXSearch,
  UpstreamError,
} from "../src/xai";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeResponsesUrl", () => {
  it("appends /responses to official and middleware base URLs", () => {
    expect(normalizeResponsesUrl("https://api.x.ai/v1")).toBe("https://api.x.ai/v1/responses");
    expect(normalizeResponsesUrl("https://cpa.example/v1/")).toBe("https://cpa.example/v1/responses");
  });

  it("accepts a full responses endpoint", () => {
    expect(normalizeResponsesUrl("https://example.test/custom/responses")).toBe(
      "https://example.test/custom/responses",
    );
  });
});

describe("buildResponsesBody", () => {
  it("defaults image and video understanding to true", () => {
    expect(buildResponsesBody({ query: "hello" }, "grok-4.6")).toEqual({
      model: "grok-4.6",
      input: "hello",
      tools: [
        {
          type: "x_search",
          enable_image_understanding: true,
          enable_video_understanding: true,
        },
      ],
      tool_choice: "required",
    });
  });

  it("passes optional x_search controls through", () => {
    expect(
      buildResponsesBody(
        {
          query: "hello",
          allowed_x_handles: ["OpenAI"],
          from_date: "2026-08-01",
          to_date: "2026-08-27",
          enable_image_understanding: false,
          enable_video_understanding: false,
        },
        "grok-4.5",
      ),
    ).toEqual({
      model: "grok-4.5",
      input: "hello",
      tools: [
        {
          type: "x_search",
          allowed_x_handles: ["OpenAI"],
          from_date: "2026-08-01",
          to_date: "2026-08-27",
          enable_image_understanding: false,
          enable_video_understanding: false,
        },
      ],
      tool_choice: "required",
    });
  });

  it("rejects both handle filters at once", () => {
    expect(() =>
      buildResponsesBody(
        { query: "hello", allowed_x_handles: ["a"], excluded_x_handles: ["b"] },
        "grok-4.6",
      ),
    ).toThrow("mutually exclusive");
  });

  it("rejects inverted date ranges", () => {
    expect(() =>
      buildResponsesBody({ query: "hello", from_date: "2026-08-27", to_date: "2026-08-01" }, "grok-4.6"),
    ).toThrow("from_date must not be later than to_date");
  });
});

describe("extractOutputText", () => {
  it("returns output_text verbatim", () => {
    expect(
      extractOutputText({
        output: [
          { type: "reasoning", summary: [] },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Result show render_inline_citation with citation_id is 0",
              },
            ],
          },
        ],
      }),
    ).toBe("Result show render_inline_citation with citation_id is 0");
  });
});

describe("runXSearch", () => {
  it("uses the Responses API and returns output text", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [{ type: "message", content: [{ type: "output_text", text: "found it" }] }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await runXSearch(
      { query: "find it" },
      { baseUrl: "https://api.x.ai/v1", model: "grok-4.6", apiKey: "test-key" },
    );

    expect(result).toBe("found it");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.x.ai/v1/responses");
  });

  it("preserves upstream error bodies verbatim", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"error":"upstream"}', { status: 401 }));

    await expect(
      runXSearch(
        { query: "find it" },
        { baseUrl: "https://api.x.ai/v1", model: "grok-4.6", apiKey: "bad-key" },
      ),
    ).rejects.toEqual(expect.objectContaining<Partial<UpstreamError>>({ body: '{"error":"upstream"}', status: 401 }));
  });
});
