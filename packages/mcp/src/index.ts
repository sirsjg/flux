#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { findFluxDir } from '@flux/shared/config';
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

    // OAuth is opt-in: set FLUX_MCP_PASSWORD to the secret you will type on the
    // consent screen. Needed for clients that cannot send a static bearer
    // token, such as Claude Cowork / claude.ai custom connectors.
    const password = process.env.FLUX_MCP_PASSWORD;
    let oauth;
    if (password) {
      const { createOAuthProvider, defaultStorePath } = await import('./oauth.js');
      const storeEnv = process.env.FLUX_MCP_OAUTH_STORE;
      oauth = createOAuthProvider({
        password,
        publicUrl: process.env.FLUX_MCP_PUBLIC_URL,
        // Persist so a restart does not force every connector to re-authorize.
        storePath: storeEnv === 'none' ? null : storeEnv || defaultStorePath(findFluxDir()),
      });
    }

    startHttpServer(createServer, HTTP_PORT, oauth, process.env.FLUX_MCP_PUBLIC_URL);
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
