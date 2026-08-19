import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProjectTools } from './tools/projects.js';
import { registerEpicTools } from './tools/epics.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerWebhookTools } from './tools/webhooks.js';
import { registerBlobTools } from './tools/blobs.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

/**
 * Create a fully-configured Flux MCP server instance.
 * Storage must be bootstrapped (see storage.ts) before handling requests.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'flux-mcp',
    version: '1.0.0',
  });

  registerProjectTools(server);
  registerEpicTools(server);
  registerTaskTools(server);
  registerWebhookTools(server);
  registerBlobTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}
