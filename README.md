# Flux &middot; [![CI](https://github.com/sirsjg/flux/actions/workflows/ci.yml/badge.svg)](https://github.com/sirsjg/flux/actions/workflows/ci.yml) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) ![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat&logo=typescript&logoColor=white) ![Preact](https://img.shields.io/badge/Preact-673ab8?style=flat&logo=preact&logoColor=white) ![Bun](https://img.shields.io/badge/Bun-fbf0df?style=flat&logo=bun&logoColor=black) ![Docker](https://img.shields.io/badge/Docker-2496ed?style=flat&logo=docker&logoColor=white) ![MCP](https://img.shields.io/badge/MCP-enabled-f59e0b?style=flat)

> Flux is a **completely open, hackable, unopinionated task management engine**.

<p align="center">
  <img src="./docs/kibo-mascot.png" width="220" />
</p>

Flux is your ultimate task management sidekick – a lightning-fast Kanban board that lets humans, AI agents, and automations team up to crush chaos. With built-in MCP (Model Context Protocol) integration, your LLMs can jump in and run the show: creating tasks, updating statuses, and keeping everything in sync. No more rigid workflows or SaaS lock-in – just pure, flexible productivity magic! ✨

Why settle for boring task trackers when you can enter the Flux Zone? Inspired by the wild energy of a flux capacitor (hello, Back to the Future fans!), this open-source gem decouples tasks from execution, making it the perfect playground for developers, teams, and AI enthusiasts. Ready to go viral? Star this repo and let's make task management fun again! ⭐

![Demo](./docs/demo.gif)

## Why Flux? Because Chaos is So Last Year 😎

Ever felt like your projects are a tangled mess of tools, bots, and half-baked ideas? Flux fixes that by being:

- **Execution-Agnostic**: Tasks live here, but how they get done? That's up to you – manual, API, webhooks, or let Claude/GPT take the wheel.
- **AI-Powered Awesomeness**: Hook up your LLMs via MCP and watch them automate the mundane. "Hey AI, create a task for fixing that bug!" – Done. 🤖
- **Simple & Speedy**: Single JSON file, drag-and-drop UI, git-native sync. No bloat, just flow.

Flux isn't just another Kanban board – it's the open-source engine for the future of work. Developers love it because it's hackable, extensible, and screams "build on me!" If you're tinkering with AI agents or just need a better way to organize, this is your ticket to productivity paradise.

<p align="center">
  <img src="./docs/sample-workflow.png" alt="Sample workflow" />
  <br />
  <em>Sample workflow</em>
</p>

## Features That'll Make You Say "whoa" 🔥

- 🚀 **Multi-Project Kanban Boards**: Juggle epics, tasks, and dependencies like a pro.
- 🔗 **Task Dependencies**: See what's blocked at a glance – no more surprises!
- 🤖 **MCP Integration**: Let LLMs list, create, update, or delete tasks programmatically.
- 📡 **Real-Time Updates**: SSE keeps everyone in sync – web UI, APIs, and beyond.
- 🪝 **Webhooks Galore**: Integrate with Slack, GitHub, CI/CD – trigger actions on task changes.
- 📱 **API-First Design**: Full REST endpoints for ultimate control.
- 💾 **Git-Native Sync**: `flux push` / `flux pull` syncs via `flux-data` branch.

- 🖥️ **CLI-First**: Full CLI with MCP parity (`flux ready`, `flux task`, etc.)
- 🧠 **Agent Memory**: Task comments for persistent context across sessions
- ⚡ **Priority System**: P0/P1/P2 priorities for agent task ordering

## Quick Start: Up and Running in a Flux Second ⚡

```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/sirsjg/flux/main/scripts/quickstart.sh | bash

## Windows (PowerShell)
irm https://raw.githubusercontent.com/sirsjg/flux/main/scripts/quickstart.ps1 | iex
```

This will start both the web UI ([http://localhost:3000](http://localhost:3000)) and the MCP server. Press Ctrl+C to stop the MCP server when you're done.

```bash
# Claude Code
claude mcp add flux -- docker run -i --rm -v flux-data:/app/packages/data flux-mcp

# Codex
codex mcp add flux -- docker run -i --rm -v flux-data:/app/packages/data flux-mcp
```

Let your agent know!

```bash
cat << 'EOF' >> AGENTS.md
---
You are an autonomous agent using Flux for task management.

RULES:
- All work MUST belong to exactly one project_id.
- You MUST NOT guess or invent a project_id.
- You MUST NOT switch projects without explicit instruction.

STARTUP (MANDATORY):
1. List projects.
2. Select or create ONE project.
3. Confirm the active project_id before any work.

EXECUTION:
- Include project_id in EVERY Flux call.
- Track all work as tasks.
- Update task status as work progresses.
- Close tasks immediately when complete.

CONTEXT LOSS:
- If unsure of project_id, STOP.
- Re-list projects and tasks.
- Ask the user if ambiguity remains.

FORBIDDEN:
- Working without a confirmed project_id.
- Mixing tasks across projects.
- Relying on memory outside Flux.

If these rules cannot be followed, halt and request clarification.
EOF
```
---

## Documentation

Looking for install options, assistant setup, APIs, or webhooks? Start here:

- [`docs/installation-docker.md`](docs/installation-docker.md) - the fastest path to a production-ready Flux stack with a shared data volume for instant sync.
- [`docs/installation-source.md`](docs/installation-source.md) - build from source, run locally, and get a dev workflow that feels effortless.
- [`docs/cli.md`](docs/cli.md) - full CLI reference for terminal-based task management with MCP parity.
- [`docs/assistant-setup.md`](docs/assistant-setup.md) - connect Claude Desktop or ChatGPT and unlock agent-driven work with best-practice guardrails.
- [`docs/ideas.md`](docs/ideas.md) - creative ways to use Flux, from agent swarms to automation-first workflows.
- [`docs/mcp.md`](docs/mcp.md) - the complete MCP surface area so your assistants can list, create, and update everything with confidence.
- [`docs/api.md`](docs/api.md) - REST endpoints for building automations, integrations, or custom frontends.
- [`docs/webhooks.md`](docs/webhooks.md) - real-time events with signatures, retries, and examples to power your workflows.
- [`docs/architecture.md`](docs/architecture.md) - understand the monorepo, storage model, and why Flux stays fast and simple.
- [`docs/roadmap.md`](docs/roadmap.md) - where Flux is headed and what we are shipping next.

## Contributing

Flux is early and moving quickly. If you want to help shape it, contributions are welcome.
Open an issue for ideas and bugs, or pick something from the roadmap and send a PR.
See `CONTRIBUTING.md` for details.

## License

MIT. See `LICENSE`.
