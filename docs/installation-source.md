# Installation (From Source)

## Prerequisites

- Node.js 21+
- pnpm 10+

## Setup

```bash
pnpm install
pnpm build
```

## Running

```bash
pnpm --filter @flux/server start
```

Visit http://localhost:3000

## Development Mode

```bash
# Terminal 1: API server with hot reload
pnpm --filter @flux/server dev

# Terminal 2: Web dev server with HMR
pnpm --filter @flux/web dev
```

Web UI will be at http://localhost:5173 (proxies API to :3000)

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
