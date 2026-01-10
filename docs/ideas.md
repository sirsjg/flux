# Ideas for Flux

Flux is intentionally unopinionated, so the best use cases are the ones you invent. Below are a few sparks to get you started.

## The Obvious (and Powerful)

Flux shines as a shared task brain for coding agents. Use it to track tasks, manage dependencies, and extend agent memory across sessions. Agents can create, update, and close work items via MCP, while humans keep visibility in the web UI.

## Human + Agent Co-Pilot Patterns

- **Issue-to-epic pipelines**: ingest GitHub issues, cluster them into epics, and let agents tackle each task with progress synced in Flux.
- **Refactor campaigns**: create a dependency chain that forces safe ordering across modules, then assign each slice to an agent.
- **Review orchestration**: when a task hits `done`, automatically spawn review tasks and notify humans.

## Automation-First Workflows

- **On-call runbooks**: turn alerts into tasks, auto-attach playbooks, and block follow-up items until the incident is resolved.
- **Release trains**: generate a release epic with checklists, dependencies, and webhooks to CI/CD.
- **Customer success loops**: convert high-signal feedback into tasks, then pipe status updates back to customers.

## Knowledge Ops

- **Research sprints**: structure exploration tasks with dependencies that prevent rabbit holes.
- **Content factories**: link research, drafting, editing, and publishing tasks with clear handoffs.
- **Learning pipelines**: auto-create tasks when new docs, APIs, or RFCs appear.

## Wildcards

- **Agent swarm control**: let multiple agents work in parallel, with Flux as the source of truth and conflict resolver.
- **Idea market**: submit ideas via form, auto-score them, and promote winners into epics.
- **Company rituals**: weekly planning, retro actions, and OKR check-ins as scheduled task flows.

If you want, open an issue with your workflow and we will help you model it in Flux.
