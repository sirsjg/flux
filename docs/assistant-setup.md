# Assistant Setup

Ready to make Flux the brains of your workflow? Here is how to wire it into Claude Desktop and ChatGPT, plus the best practices that make it feel like the next big thing.

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
      "args": ["run", "-i", "--rm", "-v", "flux-data:/app/packages/data", "flux-mcp"]
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

## ChatGPT

If your ChatGPT client supports MCP servers, add Flux as a custom MCP server using the same Docker or local command shown above. The exact menu name can vary by client, but look for MCP or Connectors in Settings.

### Docker (recommended)

```
Command: docker
Args: run -i --rm -v flux-data:/app/packages/data flux-mcp
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

If you want, I can add a ready-made agent prompt template and a minimal webhook example next.
