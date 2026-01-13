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

Run the web server:

```bash
docker run -d -p 3000:3000 -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite --name flux-web flux-mcp bun packages/server/dist/index.js
```

Open http://localhost:3000

The web UI and MCP server share the same data volume, so changes made via Claude appear instantly in the web interface.

## Using a Local Directory for Data

To store data in a specific folder instead of a Docker volume:

```bash
mkdir -p ~/flux-data

# For Claude Desktop/Code config, use:
docker run -i --rm -v ~/flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite flux-mcp

# For web UI:
docker run -d -p 3000:3000 -v ~/flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite --name flux-web flux-mcp bun packages/server/dist/index.js
```

## Storage Backend

Docker defaults to SQLite (`flux.sqlite`) for better concurrency with multiple readers.
To use JSON instead:

```bash
docker run -i --rm -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.json flux-mcp
```

## CLI in Docker

Run CLI commands via Docker:

```bash
docker run -it --rm -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite flux-mcp flux project list
docker run -it --rm -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite flux-mcp flux ready
```
