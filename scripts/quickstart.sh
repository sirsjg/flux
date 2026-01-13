#!/usr/bin/env bash
set -euo pipefail

IMAGE="sirsjg/flux-mcp:latest"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop: https://www.docker.com/get-started" >&2
  exit 1
fi

echo "Pulling Flux image..."
docker pull "$IMAGE"

echo "Starting Flux web/API..."
if docker ps -a --format '{{.Names}}' | grep -q '^flux-web$'; then
  docker rm -f flux-web >/dev/null
fi
docker run -d -p 3000:3000 -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite --name flux-web "$IMAGE" bun packages/server/dist/index.js

echo ""
echo "Flux web UI is running: http://localhost:3000"
echo ""
echo "Starting MCP server (Claude/Codex)..."
echo "Press Ctrl+C to stop the MCP server"
echo ""
docker run -i --rm -v flux-data:/app/packages/data "$IMAGE"
