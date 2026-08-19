# Installation (Docker)

Docker is the recommended way to run Flux. Build the image first:

```bash
docker build -t flux-mcp .
```

## Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "flux": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-v", "flux-data:/app/packages/data", "-e", "FLUX_DATA=/app/packages/data/flux.sqlite", "flux-mcp"]
    }
  }
}
```

Restart Claude Desktop after saving.
For ChatGPT setup and best practices, see `docs/assistant-setup.md`.

## Web Interface

Run the web server. The server is **locked by default** — pick an auth mode:

```bash
# Locked down with an API key (recommended when exposed on a network)
docker run -d -p 3000:3000 -v flux-data:/app/packages/data \
  -e FLUX_DATA=/app/packages/data/flux.sqlite \
  -e FLUX_API_KEY=change-me \
  --name flux-web flux-mcp bun packages/server/dist/index.js

# Or open access on your own machine only (loopback bind + explicit opt-in)
docker run -d -p 127.0.0.1:3000:3000 -v flux-data:/app/packages/data \
  -e FLUX_DATA=/app/packages/data/flux.sqlite \
  -e FLUX_ALLOW_ANONYMOUS=1 \
  --name flux-web flux-mcp bun packages/server/dist/index.js
```

Open http://localhost:3000

See the Authentication section of [`docs/api.md`](api.md) for key scopes,
`FLUX_CORS_ORIGINS`, and the full list of security-related variables.

The web UI and MCP server share the same data volume, so changes made via Claude appear instantly in the web interface.

## Using a Local Directory for Data

To store data in a specific folder instead of a Docker volume:

```bash
mkdir -p ~/flux-data

# For Claude Desktop/Code config, use:
docker run -i --rm -v ~/flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite flux-mcp

# For web UI (add FLUX_API_KEY or FLUX_ALLOW_ANONYMOUS=1 — see above):
docker run -d -p 127.0.0.1:3000:3000 -v ~/flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite -e FLUX_ALLOW_ANONYMOUS=1 --name flux-web flux-mcp bun packages/server/dist/index.js
```

## Storage Backend

Docker defaults to SQLite (`flux.sqlite`) for better concurrency with multiple readers.
To use JSON instead:

```bash
docker run -i --rm -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.json flux-mcp
```

## CLI with Docker Server

Install CLI locally and connect to Docker server:

```bash
# Install CLI
bun add -g flux-tasks
# or: npm install -g flux-tasks

# Initialize with Docker server
cd your-repo
flux init --server http://localhost:3000

# CLI now talks to Docker server
flux project list
flux ready
```
