import { timingSafeEqual } from 'crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const jsonRpcError = (status: number, code: number, message: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export type HttpServerHandle = {
  port: number;
  stop: () => void;
};

/**
 * Serve the MCP server over Streamable HTTP (requires Bun).
 *
 * - One transport + server instance per MCP session, routed by the
 *   Mcp-Session-Id header
 * - Optional bearer auth: set FLUX_MCP_TOKEN to require
 *   `Authorization: Bearer <token>` on every /mcp request
 */
export function startHttpServer(createServer: () => McpServer, port: number): HttpServerHandle {
  const authToken = process.env.FLUX_MCP_TOKEN;
  const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

  const handleMcp = async (req: Request): Promise<Response> => {
    if (authToken) {
      const header = req.headers.get('authorization');
      const provided = header?.startsWith('Bearer ') ? header.slice(7) : null;
      if (!provided || !safeCompare(provided, authToken)) {
        return jsonRpcError(401, -32001, 'Unauthorized', { 'WWW-Authenticate': 'Bearer' });
      }
    }

    const sessionId = req.headers.get('mcp-session-id');
    if (sessionId) {
      const transport = transports.get(sessionId);
      if (!transport) {
        return jsonRpcError(404, -32001, 'Session not found');
      }
      return transport.handleRequest(req);
    }

    // No session yet: only an initialize POST may create one
    if (req.method !== 'POST') {
      return jsonRpcError(400, -32000, 'Bad Request: missing Mcp-Session-Id header');
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (sid) => {
        transports.set(sid, transport);
      },
      onsessionclosed: (sid) => {
        transports.delete(sid);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) transports.delete(transport.sessionId);
    };

    await createServer().connect(transport);
    return transport.handleRequest(req);
  };

  const httpServer = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/mcp') {
        return handleMcp(req);
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  console.error(`Flux MCP server running on http://localhost:${httpServer.port}/mcp`);
  console.error(
    authToken
      ? 'HTTP auth: enabled (FLUX_MCP_TOKEN)'
      : 'HTTP auth: disabled — set FLUX_MCP_TOKEN to require a bearer token'
  );

  return {
    port: httpServer.port as number,
    stop: () => httpServer.stop(true),
  };
}
