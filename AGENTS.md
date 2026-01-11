# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

Flux is a Kanban board application with multi-project support, designed for both web UI and AI assistant integration via MCP (Model Context Protocol). It's a TypeScript monorepo with five packages sharing a common data store.

## Dogfooding

This repo uses Flux to manage itself. Tasks live on `flux-data` branch:

```bash
flux pull               # Get latest tasks
flux ready              # Show unblocked tasks
flux push "message"     # Push task changes
```

## Common Commands

### Development

```bash
# Start API server (port 3000)
bun --filter @flux/server dev

# Start web dev server (port 5173, proxies API to :3000)
bun --filter @flux/web dev
```

### Build & Test

```bash
bun run build           # Build all packages
bun run typecheck       # Type check all packages
bun run test            # Run tests
```

### CLI

```bash
cd packages/cli && bun link   # Link globally
flux init                     # Initialize in a repo
flux ready                    # Show ready tasks
flux task create <project> <title> -P 0  # Create P0 task
```

### Docker

```bash
docker build -t flux-mcp .

# Mount repo's .flux directory
docker run -d -p 3000:3000 -v $(pwd)/.flux:/app/.flux -e FLUX_DATA=/app/.flux/data.json flux-mcp node packages/server/dist/index.js
```

## Architecture

```
CLI (core, standalone)        Server (optional)
├── Per-repo .flux/           ├── Web dashboard for .flux/
├── Git-native sync           ├── SSE for live updates
├── Works offline             ├── Future: multi-repo aggregator
└── Zero dependencies         └── Reads same JSON as CLI
```

```
packages/
├── cli/        # CLI tool - core, standalone
├── shared/     # Core types and storage abstraction
├── web/        # Preact frontend (optional dashboard)
├── server/     # Multi-repo aggregator (optional)
└── mcp/        # MCP server for LLM integration
```

**Key architectural decisions:**
- CLI is the core, works standalone with git-native sync
- Server is optional - aggregates tasks across multiple repos
- Each repo has `.flux/data.json` synced via `flux-data` branch
- Tasks have P0/P1/P2 priority levels for agent task ordering
- Tasks can depend on other tasks/epics; blocked tasks show visual indicators

## Data Model

```typescript
type Task = {
  id: string;
  title: string;
  status: 'planning' | 'todo' | 'in_progress' | 'done';
  depends_on: string[];
  notes: string;           // Append with --note for agent memory
  epic_id?: string;
  project_id: string;
  priority?: 0 | 1 | 2;    // P0=urgent, P1=normal, P2=low
  created_at?: string;
  updated_at?: string;
};

type Epic = {
  id: string;
  title: string;
  status: string;
  depends_on: string[];
  notes: string;
  project_id: string;
};

type Project = {
  id: string;
  name: string;
  description?: string;
};
```

## Tech Stack

- **CLI:** Bun, TypeScript
- **Frontend:** Preact, Vite, Tailwind CSS, DaisyUI, @dnd-kit
- **Backend:** Hono, Node.js 22
- **Data:** JSON file (`.flux/data.json`), git-native sync
- **LLM Integration:** @modelcontextprotocol/sdk
- **Build:** TypeScript 5.6, Bun workspaces

## Requirements

- Bun 1.0+
