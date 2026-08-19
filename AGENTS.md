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

# Mount repo's .flux directory (SQLite for better concurrency)
docker run -d -p 3000:3000 -v $(pwd)/.flux:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite flux-mcp
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
  comments?: TaskComment[]; // Add with --note for agent memory
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
- **Backend:** Hono, Bun
- **Data:** JSON file (`.flux/data.json`), git-native sync
- **LLM Integration:** @modelcontextprotocol/sdk
- **Build:** TypeScript 5.6, Bun workspaces

## Requirements

- Bun 1.0+

<!-- FLUX:START -->
## Flux Task Management

You have access to Flux for task management, via MCP tools or the `flux` CLI.

**Project scope:**
- All work belongs to exactly one project. On startup, list projects
  (`flux project list`), then select or create one and confirm its project_id
  before doing any work.
- Include that project_id in every Flux call. Never guess a project_id, and
  never switch projects without explicit instruction.

**Working a task:**
- Track all work as tasks. Pick the next task with `list_ready_tasks` (or
  `flux ready`) — it excludes blocked tasks and sorts by priority (P0 first).
- Set status to in_progress when you start and done as soon as you finish.
  Tasks in planning must move to todo before in_progress.
- Pass your agent_name on status changes so the board shows who is working.
- Don't start a task whose dependencies aren't done.

**Memory and scope:**
- Record decisions, findings, and blockers as task comments — they are your
  memory across sessions. Check a task's comments before starting it.
- When you discover new work, create a task for it (with acceptance criteria)
  rather than expanding the current task's scope.

**If context is lost:** stop, re-list projects and tasks, and ask the user if
ambiguity remains.
<!-- FLUX:END -->
