# x-search-mcp

A Cloudflare Worker that exposes xAI's server-side `x_search` as a Streamable HTTP MCP server.

The `search` tool forwards requests to an OpenAI/xAI Responses-compatible endpoint, including compatible middleware such as CLIProxyAPI. It keeps the original tool arguments and returns the upstream text as received.

## MCP interface

- Server name: `x-search`
- Transport: Streamable HTTP
- Endpoint: `/mcp` by default, or `/<SECRET_PATH>/mcp` when the optional secret is set
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

## Worker environment

Production runtime configuration is managed in the Cloudflare dashboard, which is the canonical source for variables and secrets. `wrangler.jsonc` uses `keep_vars: true` and intentionally does not declare runtime variables or secrets.

Current settings used by the Worker:

- `XAI_BASE_URL` (required variable): for example `https://api.x.ai/v1`, or a compatible middleware base URL ending in `/v1`.
- `XAI_MODEL` (required variable): the model passed to the Responses API.
- `XAI_API_KEY` (required secret): bearer credential accepted by the configured upstream.
- `SECRET_PATH` (optional secret): a hard-to-guess URL prefix. If set, `/mcp` returns 404, and the root health response does not disclose the secret.

The `SECRET_PATH` value is a shared URL secret, not user-specific authentication. Anyone with the full endpoint URL can use the upstream credential. Do not publish the complete URL.

Only the Responses API is used. Each call sends one native `x_search` tool with `tool_choice: "required"`. Non-2xx upstream response bodies are returned to the MCP client.

## Development

```bash
npm ci
npm run build
npm test
```

For local development, put the required upstream values in a git-ignored `.dev.vars` file and run `npx wrangler dev`. Add `SECRET_PATH` there as well when testing the optional secret path locally. Do not put production secrets on the command line.

## Deployment

Configure production variables and secrets on the existing Worker in the Cloudflare dashboard. Cloudflare Workers Builds connects this repository's `main` branch to the existing `x-search-mcp` Worker; pushing to `main` runs the tests and type-check, then deploys it. Because `wrangler.jsonc` sets `keep_vars: true`, dashboard-managed variables are preserved across deployments; Worker secrets are also kept remotely rather than stored in Git.

For a manual deployment, run `npm run deploy`.

MCP clients should use the full Streamable HTTP endpoint URL, with no `npx` command or stdio settings.
