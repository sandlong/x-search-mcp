# x-search-mcp

A thin, stateless MCP wrapper around xAI's server-side `x_search` tool.

The server speaks remote MCP over Streamable HTTP and forwards each `search` call to an OpenAI/xAI Responses-compatible endpoint. It is designed to work with both the official xAI endpoint and middleware such as CLIProxyAPI that implements the same Responses + `x_search` protocol.

## MCP interface

- Server name: `x-search`
- Endpoint: `/mcp`
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

The deployment operator provides exactly three upstream settings:

- `XAI_BASE_URL` — for example `https://api.x.ai/v1` or an OpenAI/xAI-compatible middleware base URL ending in `/v1`
- `XAI_MODEL` — for example `grok-4.6`
- `XAI_API_KEY` — bearer credential accepted by the configured upstream

The Worker itself has no MCP authentication layer. Access to the MCP endpoint is therefore public; each call uses the upstream credential configured on that Worker deployment.

For a Cloudflare Workers deployment, keep the repository generic and set the values on the deployment rather than committing them:

```bash
wrangler secret put XAI_BASE_URL
wrangler secret put XAI_MODEL
wrangler secret put XAI_API_KEY
```

The implementation only uses the Responses API. It sends one native `x_search` tool and forces tool use with `tool_choice: "required"`.

## Local development

Create `.dev.vars` (ignored by Git):

```dotenv
XAI_BASE_URL=https://api.x.ai/v1
XAI_MODEL=grok-4.6
XAI_API_KEY=...
```

Then:

```bash
npm install
npm test
npm run typecheck
npm run dev
```

## Deployment

```bash
npm run deploy
```

The repository also includes a GitHub Actions deployment workflow. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repository secrets. The three xAI settings remain Cloudflare Worker secrets and persist independently of code deployments.

## Behavior

- No Chat Completions compatibility layer.
- No result rewriting or citation cleanup; xAI/middleware output text is returned as received.
- Non-2xx upstream response bodies are returned to the MCP client verbatim.
- No database, Durable Object, KV, or other state.
