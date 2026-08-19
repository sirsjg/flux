#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { bootstrapStorage } from './storage.js';
import { createServer } from './server.js';

// Parse CLI args for transport mode
const args = process.argv.slice(2);
const httpMode = args.includes('--http');
const portArg = args.find((a) => a.startsWith('--port='));
const HTTP_PORT = portArg ? parseInt(portArg.split('=')[1]) : 3001;

bootstrapStorage();

async function main() {
  if (httpMode) {
    if (typeof Bun === 'undefined') {
      console.error('HTTP mode requires Bun (run with `bun`, not `node`).');
      process.exit(1);
    }
    const { startHttpServer } = await import('./http.js');
    startHttpServer(createServer, HTTP_PORT);
  } else {
    // Default stdio mode
    const server = createServer();
    await server.connect(new StdioServerTransport());
    console.error('Flux MCP server running on stdio');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
