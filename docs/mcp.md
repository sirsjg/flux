# MCP

The Flux MCP server exposes tools, resources, and prompts over the Model
Context Protocol. It runs on **stdio** by default (for Claude Desktop, Claude
Code, Codex, etc.) or over **Streamable HTTP** with `--http`.

```bash
# stdio (default)
flux-mcp

# Streamable HTTP on port 3001 (requires Bun)
flux-mcp --http --port=3001
```

## Remote Server Mode

The MCP server can connect to a remote Flux API instead of using local storage:

```bash
FLUX_SERVER=https://flux.example.com FLUX_API_KEY=your-key npx @flux/mcp
```

| Variable | Description |
|----------|-------------|
| `FLUX_SERVER` | Remote Flux server URL |
| `FLUX_API_KEY` | API key for write operations against the remote server |
| `FLUX_MCP_TOKEN` | HTTP mode only: require `Authorization: Bearer <token>` on `/mcp` requests |
| `FLUX_MCP_PASSWORD` | HTTP mode only: enable OAuth and set the consent-screen password |
| `FLUX_MCP_PUBLIC_URL` | HTTP mode only: public origin to advertise in OAuth metadata (derived from request headers if unset) |
| `FLUX_MCP_OAUTH_STORE` | HTTP mode only: path for persisted OAuth state, or `none` to keep it in memory |

## HTTP Mode

`--http` serves the MCP Streamable HTTP transport at `/mcp` (plus a `/health`
endpoint). Each MCP session gets its own server instance, routed by the
`Mcp-Session-Id` header.

The endpoint is **unauthenticated by default** — set `FLUX_MCP_TOKEN` to
require a bearer token before exposing it beyond localhost:

```bash
FLUX_MCP_TOKEN=change-me bun packages/mcp/dist/index.js --http --port=3001
```

## OAuth

A static bearer token works for clients that let you set a header (Claude Code,
`curl`, your own scripts). It does **not** work for clients that connect from a
vendor's infrastructure — Claude Cowork and claude.ai custom connectors only
authenticate over OAuth, with no field for a static token. For those, set
`FLUX_MCP_PASSWORD` to turn on the built-in OAuth authorization server:

```bash
FLUX_MCP_PASSWORD=change-me bun packages/mcp/dist/index.js --http --port=3001
```

The server then implements the discovery and grant endpoints MCP clients use:

| Endpoint | Purpose |
|----------|---------|
| `/.well-known/oauth-protected-resource` | RFC 9728 protected resource metadata |
| `/.well-known/oauth-authorization-server` | RFC 8414 authorization server metadata |
| `/register` | RFC 7591 dynamic client registration |
| `/authorize` | Consent screen; asks for `FLUX_MCP_PASSWORD` |
| `/token` | Authorization code (PKCE `S256`) and refresh token grants |

The flow is: the client hits `/mcp`, gets a `401` carrying
`WWW-Authenticate: Bearer resource_metadata=...`, follows the metadata,
registers itself, sends you to `/authorize` where you enter the password, then
exchanges the code for an access token and retries `/mcp` with it.

Both schemes can run together — `FLUX_MCP_TOKEN` for Claude Code and scripts,
OAuth for remote connectors. Access tokens last an hour; refresh tokens rotate
on every use. Registered clients and refresh tokens are persisted (see
`FLUX_MCP_OAUTH_STORE`) so a restart does not force every connector to
re-authorize.

Behind a reverse proxy or tunnel, the public origin is taken from
`X-Forwarded-Proto` / `X-Forwarded-Host` (falling back to `Host`). Set
`FLUX_MCP_PUBLIC_URL` explicitly if those are not reliable — the value must
match the URL clients connect to, or OAuth discovery will fail.

The password authorises *reaching* the MCP endpoint. Calls to Flux itself still
use the server's `FLUX_API_KEY`, so scope that key to the projects the
assistant should touch.

## MCP Tools

All tools validate input (zod schemas), return structured output
(`structuredContent`) alongside JSON text, and carry behavior annotations
(read-only / destructive hints) so clients can decide what needs confirmation.

| Tool | Description |
|------|-------------|
| `list_projects` | List all projects with stats *(read-only)* |
| `create_project` | Create a new project |
| `update_project` | Update project details |
| `delete_project` | Delete a project and all its data *(destructive)* |
| `list_epics` | List epics in a project *(read-only)* |
| `create_epic` | Create a new epic |
| `update_epic` | Update epic details/status/dependencies |
| `delete_epic` | Delete an epic *(destructive)* |
| `list_tasks` | List tasks (with optional epic/status filters) *(read-only)* |
| `list_ready_tasks` | List ready tasks (unblocked, not done, sorted by priority) *(read-only)* |
| `create_task` | Create a new task (title, epic, priority, dependencies, acceptance criteria, guardrails) |
| `update_task` | Update task details/status/dependencies |
| `delete_task` | Delete a task *(destructive)* |
| `move_task_status` | Quick status change (planning/todo/in_progress/done) |
| `add_task_comment` | Add a comment to a task (agent memory) |
| `delete_task_comment` | Delete a task comment *(destructive)* |
| `list_webhooks` | List configured webhooks *(read-only)* |
| `create_webhook` | Create a webhook |
| `update_webhook` | Update a webhook |
| `delete_webhook` | Delete a webhook *(destructive)* |
| `list_webhook_deliveries` | List recent delivery attempts *(read-only)* |
| `blob_attach` | Attach a file from disk to a task |
| `blob_get` | Get blob content (base64) and metadata *(read-only)* |
| `blob_list` | List blobs, optionally by task *(read-only)* |
| `blob_delete` | Delete a blob *(destructive)* |

Workflow rule: tasks in `planning` cannot move directly to `in_progress` —
move them to `todo` first. Status changes with an `agent_name` are tracked as
workers on the Kanban board.

## MCP Resources

| URI | Description |
|-----|-------------|
| `flux://projects` | All projects with stats |
| `flux://projects/{projectId}` | Single project details |
| `flux://projects/{projectId}/epics` | All epics in a project |
| `flux://projects/{projectId}/tasks` | All tasks in a project (with blocked status) |

The per-project URIs are advertised as resource templates and also enumerated
per existing project in `resources/list`.

## MCP Prompts

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `whats_next` | `project_id` (optional) | Find and prioritize the next task(s) to work on |
| `project_status` | `project_id` | Summarize a project board: progress, blockers, stale work, next actions |
