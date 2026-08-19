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
# Quickstart: bind to loopback only and explicitly opt into keyless access.
# To expose Flux on your network, run with -p 3000:3000 and -e FLUX_API_KEY=<secret> instead.
docker run -d -p 127.0.0.1:3000:3000 -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite -e FLUX_ALLOW_ANONYMOUS=1 --name flux-web "$IMAGE" bun packages/server/dist/index.js

echo ""
echo "Flux web UI is running: http://localhost:3000 (local access only)"
echo "To expose it on your network, restart with -p 3000:3000 and -e FLUX_API_KEY=<secret>."
echo ""
echo "Starting MCP server (Claude/Codex)..."
echo "Press Ctrl+C to stop the MCP server"
echo ""
docker run -i --rm -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite "$IMAGE" bun packages/mcp/dist/index.js
