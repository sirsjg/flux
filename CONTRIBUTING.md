# Contributing

Thanks for considering a contribution. This project is intentionally small and focused, so changes should be targeted and easy to review.

## Development Setup

- [Bun](https://bun.sh/) 1.1+

```bash
bun install
bun run build
```

### Run Locally

```bash
# Terminal 1: API server with hot reload
bun --filter @flux/server dev

# Terminal 2: Web dev server with HMR
bun --filter @flux/web dev
```

### MCP Server

```bash
bun --filter @flux/mcp build
bun packages/mcp/dist/index.js
```

## Pull Requests

- Keep PRs small and focused.
- Update or add documentation when behavior changes.
- Ensure `bun run build` passes.

## Reporting Issues

Please include:

- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version)
