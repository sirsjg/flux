# Architecture

## Project Structure

```
packages/
  shared/   - Shared types and store logic
  web/      - Preact frontend with DaisyUI
  server/   - Hono API server
  mcp/      - MCP server for LLM integration
```

## Data Storage

All data is stored in `packages/data/flux.sqlite`. This file is shared between the web UI and MCP server, so changes made via either interface are immediately visible in both. If `packages/data/flux.json` exists on first run, Flux imports it into SQLite and removes the JSON file.

## Tech Stack

- **Frontend:** Preact, TypeScript, Tailwind CSS, DaisyUI, @dnd-kit
- **Backend:** Hono, Node.js
- **Data:** SQLite (single-file persistence)
- **MCP:** @modelcontextprotocol/sdk
- **Build:** Vite, pnpm workspaces
