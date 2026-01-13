# Installation (From Source)

## Prerequisites

- [Bun](https://bun.sh/) 1.1+

## Setup

```bash
bun install
bun run build
```

## Running

```bash
bun --filter @flux/server start
```

Visit http://localhost:3000

## Development Mode

```bash
# Terminal 1: API server with hot reload
bun --filter @flux/server dev

# Terminal 2: Web dev server with HMR
bun --filter @flux/web dev
```

Web UI will be at http://localhost:5173 (proxies API to :3000)

## CLI

The CLI (`flux`) provides full task management from the terminal.

```bash
# Build and link globally
cd packages/cli && bun run build && bun link

# Or run directly
bun packages/cli/src/index.ts
```

See [cli.md](./cli.md) for full CLI documentation.

## MCP with Local Install

Add to Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

For Claude Code:

```bash
# Claude Code
claude mcp add flux -- node /path/to/flux/packages/mcp/dist/index.js

# Codex
codex mcp add flux -- node /path/to/flux/packages/mcp/dist/index.js
```

For ChatGPT setup and best practices, see `docs/assistant-setup.md`.
