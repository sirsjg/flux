# Architecture

## Project Structure

```
packages/
  shared/   - Shared types and store logic
  web/      - Preact frontend with DaisyUI
  server/   - Hono API server
  mcp/      - MCP server for LLM integration
  cli/      - CLI for terminal-based task management
```

## Data Storage

Flux supports two storage backends, selected automatically based on file extension:

| Extension | Backend | Best For |
|-----------|---------|----------|
| `.sqlite`, `.db` | SQLite | Production, Docker, concurrent access |
| `.json` | JSON | Development, git sync, human-readable |

Set via `FLUX_DATA` environment variable:

```bash
# SQLite (recommended for production)
FLUX_DATA=/app/data/flux.sqlite bun packages/server/dist/index.js

# JSON (default for local dev)
FLUX_DATA=.flux/data.json flux serve
```

Docker defaults to SQLite at `/app/packages/data/flux.sqlite`.

## Tech Stack

- **Frontend:** Preact, TypeScript, Tailwind CSS, DaisyUI, @dnd-kit
- **Backend:** Hono, Bun
- **Data:** SQLite or JSON (configurable)
- **MCP:** @modelcontextprotocol/sdk
- **Build:** Vite, Bun workspaces
