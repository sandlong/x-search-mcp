export type XSearchInput = {
  query: string;
  allowed_x_handles?: string[];
  excluded_x_handles?: string[];
  from_date?: string;
  to_date?: string;
  enable_image_understanding?: boolean;
  enable_video_understanding?: boolean;
};

export type XaiConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
};

export class UpstreamError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(body);
    this.name = "UpstreamError";
  }
}

export function normalizeResponsesUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("XAI_BASE_URL is required");
  }
  return trimmed.endsWith("/responses") ? trimmed : `${trimmed}/responses`;
}

export function validateXSearchInput(input: XSearchInput): void {
  if (input.allowed_x_handles?.length && input.excluded_x_handles?.length) {
    throw new Error("allowed_x_handles and excluded_x_handles are mutually exclusive");
  }
  if (input.from_date && input.to_date && input.from_date > input.to_date) {
    throw new Error("from_date must not be later than to_date");
  }
}

export function buildResponsesBody(input: XSearchInput, model: string): Record<string, unknown> {
  validateXSearchInput(input);

  const tool: Record<string, unknown> = {
    type: "x_search",
    enable_image_understanding: input.enable_image_understanding ?? true,
    enable_video_understanding: input.enable_video_understanding ?? true,
  };

  if (input.allowed_x_handles?.length) tool.allowed_x_handles = input.allowed_x_handles;
  if (input.excluded_x_handles?.length) tool.excluded_x_handles = input.excluded_x_handles;
  if (input.from_date) tool.from_date = input.from_date;
  if (input.to_date) tool.to_date = input.to_date;

  return {
    model,
    input: input.query,
    tools: [tool],
    tool_choice: "required",
  };
}

export function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";

  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "message") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object" || (part as { type?: unknown }).type !== "output_text") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("\n");
}

export async function runXSearch(input: XSearchInput, config: XaiConfig): Promise<string> {
  const response = await fetch(normalizeResponsesUrl(config.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildResponsesBody(input, config.model)),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new UpstreamError(response.status, raw);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return raw;
  }

  const text = extractOutputText(payload);
  return text || raw;
}
