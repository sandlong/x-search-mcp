# x-search-mcp

A thin stdio MCP wrapper around xAI's server-side `x_search` tool.

The server reads its upstream configuration from environment variables and forwards each `search` call to an OpenAI/xAI Responses-compatible endpoint. It is designed to work with both the official xAI endpoint and middleware such as CLIProxyAPI that implements the same Responses + `x_search` protocol.

## MCP interface

- Server name: `x-search`
- Transport: stdio
- Tool: `search`

Tool arguments:

| Field | Required | Default | Notes |
| --- | --- | --- | --- |
| `query` | yes | — | Search request for Grok |
| `allowed_x_handles` | no | omitted | Max 20; mutually exclusive with `excluded_x_handles` |
| `excluded_x_handles` | no | omitted | Max 20; mutually exclusive with `allowed_x_handles` |
| `from_date` | no | omitted | Inclusive `YYYY-MM-DD` |
| `to_date` | no | omitted | Inclusive `YYYY-MM-DD` |
| `enable_image_understanding` | no | `true` | Passed to native `x_search` |
| `enable_video_understanding` | no | `true` | Passed to native `x_search` |

The handle-filter state is one of three choices: no filter (default), an allow-list, or an exclude-list. Supplying both lists is rejected.

## Environment

The MCP client provides exactly three upstream settings to the spawned process:

- `XAI_BASE_URL` — for example `https://api.x.ai/v1` or an OpenAI/xAI-compatible middleware base URL ending in `/v1`
- `XAI_MODEL` — for example `grok-4.6`
- `XAI_API_KEY` — bearer credential accepted by the configured upstream

The implementation only uses the Responses API. It sends one native `x_search` tool and forces tool use with `tool_choice: "required"`.

## Install / run

For clients that support stdio MCP servers, run directly from GitHub:

```bash
npx -y github:sandlong/x-search-mcp
```

and provide the three variables in that MCP server's `env` configuration. For example:

```json
{
  "command": "npx",
  "args": ["-y", "github:sandlong/x-search-mcp"],
  "env": {
    "XAI_BASE_URL": "https://api.x.ai/v1",
    "XAI_MODEL": "grok-4.6",
    "XAI_API_KEY": "..."
  }
}
```

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Behavior

- No Chat Completions compatibility layer.
- No result rewriting or citation cleanup; xAI/middleware output text is returned as received.
- Non-2xx upstream response bodies are returned to the MCP client verbatim.
- No HTTP server, database, or persistent state.
