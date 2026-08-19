# Assistant Setup

How to connect Flux to Claude Desktop, Claude Cowork, and ChatGPT, plus best practices for reliable agent-driven task management.

## Claude Desktop

### Docker (recommended)

Add Flux to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "flux": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-v", "flux-data:/app/packages/data", "-e", "FLUX_DATA=/app/packages/data/flux.sqlite", "flux-mcp"]
    }
  }
}
```

Restart Claude Desktop after saving.

### Local install

Use a local build of the MCP server:

```json
{
  "mcpServers": {
    "flux": {
      "command": "node",
      "args": ["/path/to/flux/packages/mcp/dist/index.js"]
    }
  }
}
```

## Claude Cowork

Claude Cowork does not support local stdio MCP servers — connectors are configured on your Claude account and the connection to your MCP server originates from **Anthropic's infrastructure**, not your machine. That means Flux must be reachable over the public internet as a Streamable HTTP endpoint.

### 1. Run the MCP server in HTTP mode

```bash
# Serves the MCP Streamable HTTP transport at /mcp (requires Bun)
FLUX_MCP_TOKEN=<secret> bun packages/mcp/dist/index.js --http --port=3001
```

The endpoint is unauthenticated by default; set `FLUX_MCP_TOKEN` to require `Authorization: Bearer <token>` before exposing it beyond localhost.

To point the MCP server at a hosted Flux API instead of local storage, set `FLUX_SERVER` and `FLUX_API_KEY` — see `docs/mcp.md`.

### 2. Make it publicly reachable

`localhost` will not work. Options:

- A hosted deployment behind HTTPS (recommended for anything long-lived)
- A reverse proxy on a server you control
- A tunnel such as `cloudflared` or `ngrok` for quick testing

### 3. Add the custom connector

1. On claude.ai, go to **Settings → Connectors** (Team/Enterprise: an Owner adds it under **Organization settings → Connectors** first).
2. Click **Add custom connector** and enter the public server URL, e.g. `https://your-host/mcp`.
3. Enable the connector in Cowork and confirm the Flux tools appear.

Because the endpoint is internet-facing, always use HTTPS, set `FLUX_MCP_TOKEN`, and scope any `FLUX_API_KEY` to the minimum permissions the assistant needs.

## ChatGPT

If your ChatGPT client supports MCP servers, add Flux as a custom MCP server using the same Docker or local command shown above. The exact menu name can vary by client, but look for MCP or Connectors in Settings.

### Docker (recommended)

```
Command: docker
Args: run -i --rm -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite flux-mcp
```

### Local install

```
Command: node
Args: /path/to/flux/packages/mcp/dist/index.js
```

If your ChatGPT client does not support MCP servers, you can still use Flux via the REST API and webhooks in `docs/api.md` and `docs/webhooks.md`.

## Best Practices for a Smooth, Powerful Setup

- Keep one shared data location so your web UI and assistants stay in sync. Use the Docker volume shown above or a local folder mount.
- Give your assistant a strict project_id workflow. The AGENTS.md snippet in the quickstart keeps agents honest and makes tasks reliable.
- Create one project per initiative. It keeps context clean and prevents accidental cross-project updates.
- Use clear task titles and short notes. Your assistant will generate better plans and fewer follow-up questions.
- Turn on webhooks for your favorite tools and set a secret for signatures. It is the fastest path to automations that feel alive.
- Back up `packages/data/flux.sqlite` or your local data folder. That file is the single source of truth.
- Start every session by listing projects and tasks. It primes the assistant and cuts down on surprises.
