# Flux - Kanban Board with MCP Server
# Multi-stage build using Bun

FROM oven/bun:1.3.5 AS base
WORKDIR /app

# ============ Build Stage ============
FROM base AS builder

ARG BUILD_SHA
ARG BUILD_TIME

ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME

# Copy everything
COPY . .

# Install dependencies and build
RUN bun install && bun run build

# ============ Production Stage ============
FROM oven/bun:1.3.5-slim AS runner

WORKDIR /app

ARG BUILD_SHA
ARG BUILD_TIME

ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME
ENV NODE_ENV=production

# Create non-root user for security
RUN groupadd --system --gid 1001 flux && \
    useradd --system --uid 1001 --gid flux flux

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/mcp/dist ./packages/mcp/dist
COPY --from=builder /app/packages/mcp/package.json ./packages/mcp/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/web/dist ./packages/web/dist
COPY --from=builder /app/packages/web/package.json ./packages/web/

# Copy node_modules for runtime dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/mcp/node_modules ./packages/mcp/node_modules
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules

# Copy root package.json for module resolution
COPY package.json ./

# Create data directory with proper permissions
RUN mkdir -p /app/packages/data && chown -R flux:flux /app

USER flux

EXPOSE 3000

# Default to MCP server mode (stdio)
# Override with: docker run ... bun packages/server/dist/index.js
CMD ["bun", "packages/mcp/dist/index.js"]
