# Flux - Kanban Board with MCP Server
# Multi-stage build for optimized image size

FROM node:22-bookworm-slim AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ============ Dependencies Stage ============
FROM base AS deps

# Native deps for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/mcp/package.json ./packages/mcp/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN pnpm install

# ============ Build Stage ============
FROM base AS builder

ARG BUILD_SHA
ARG BUILD_TIME

ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/mcp/node_modules ./packages/mcp/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules

# Copy source files
COPY . .

# Build all packages
RUN pnpm run build

# ============ Production Stage ============
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ARG BUILD_SHA
ARG BUILD_TIME

ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME

# Create non-root user for security
RUN addgroup --system --gid 1001 flux && \
    adduser --system --uid 1001 flux

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/mcp/dist ./packages/mcp/dist
COPY --from=builder /app/packages/mcp/package.json ./packages/mcp/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/web/dist ./packages/web/dist
COPY --from=builder /app/packages/web/package.json ./packages/web/

# Copy node_modules (production only would be ideal, but we need workspace links)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/mcp/node_modules ./packages/mcp/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules

# Copy root package.json for module resolution
COPY package.json pnpm-workspace.yaml ./

# Create data directory with proper permissions
RUN mkdir -p /app/packages/data && chown -R flux:flux /app

USER flux

# Default to MCP server mode (stdio)
# Override with CMD ["node", "packages/server/dist/index.js"] for web server
ENV NODE_ENV=production
EXPOSE 3000

# Entry point - can be overridden
CMD ["node", "packages/mcp/dist/index.js"]
