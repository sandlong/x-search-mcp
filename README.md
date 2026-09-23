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

Configure these Worker secrets:

- `XAI_BASE_URL` (required): for example `https://api.x.ai/v1`, or a compatible middleware base URL ending in `/v1`.
- `XAI_MODEL` (required): the model passed to the Responses API.
- `XAI_API_KEY` (required): bearer credential accepted by the configured upstream.
- `SECRET_PATH` (optional): a hard-to-guess URL prefix. If set, `/mcp` returns 404, and the root health response does not disclose the secret.

The `SECRET_PATH` value is a shared URL secret, not user-specific authentication. Anyone with the full endpoint URL can use the upstream credential. Do not publish the complete URL.

Only the Responses API is used. Each call sends one native `x_search` tool with `tool_choice: "required"`. Non-2xx upstream response bodies are returned to the MCP client.

## Development

```bash
npm ci
npm run build
npm test
```

For local development, put the three required upstream values in a git-ignored `.dev.vars` file and run `npx wrangler dev`. Wrangler's required-secret declaration loads only the three listed values from `.dev.vars`; to test an optional secret path locally, use `npx wrangler dev --var SECRET_PATH:local-test-path`. Do not put a production secret on the command line.

## Deployment

Set the three required Worker secrets before deployment (through the dashboard or Wrangler), then run `npm run deploy`. Set `SECRET_PATH` as another Worker secret to hide the endpoint behind that path.

Cloudflare Workers Builds connects this repository's `main` branch to the existing `x-search-mcp` Worker. Pushing to `main` runs the tests and type-check, then deploys it. The upstream and secret-path bindings are configured on the production Worker and persist across deployments.

MCP clients should use the full Streamable HTTP endpoint URL, with no `npx` command or stdio settings.
