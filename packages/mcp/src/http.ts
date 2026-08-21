import { timingSafeEqual } from 'crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveBaseUrl, type OAuthProvider } from './oauth.js';

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
 * - Optional OAuth: pass a provider to additionally accept OAuth access
 *   tokens, for clients that cannot send a static bearer (Claude Cowork and
 *   other claude.ai custom connectors)
 */
export function startHttpServer(
  createServer: () => McpServer,
  port: number,
  oauth?: OAuthProvider,
  publicUrl?: string
): HttpServerHandle {
  const authToken = process.env.FLUX_MCP_TOKEN;
  const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

  const handleMcp = async (req: Request, baseUrl: string): Promise<Response> => {
    if (authToken || oauth) {
      const header = req.headers.get('authorization');
      const provided = header?.startsWith('Bearer ') ? header.slice(7) : null;
      // Either credential is sufficient: a static token (Claude Code, scripts)
      // or an OAuth access token (Cowork and other remote connectors).
      const ok = !!provided && ((!!authToken && safeCompare(provided, authToken)) || (!!oauth && oauth.verify(provided)));
      if (!ok) {
        // Point OAuth-capable clients at the metadata that starts the flow.
        const challenge = oauth ? oauth.challenge(baseUrl) : 'Bearer';
        return jsonRpcError(401, -32001, 'Unauthorized', { 'WWW-Authenticate': challenge });
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
      const baseUrl = resolveBaseUrl(req, publicUrl);

      if (oauth) {
        const handled = await oauth.handle(req, baseUrl);
        if (handled) return handled;
      }

      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/mcp') {
        return handleMcp(req, baseUrl);
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  console.error(`Flux MCP server running on http://localhost:${httpServer.port}/mcp`);
  const modes = [authToken && 'static token', oauth && 'OAuth'].filter(Boolean);
  console.error(
    modes.length
      ? `HTTP auth: enabled (${modes.join(' + ')})`
      : 'HTTP auth: disabled — set FLUX_MCP_TOKEN or FLUX_MCP_PASSWORD before exposing this'
  );

  return {
    port: httpServer.port as number,
    stop: () => httpServer.stop(true),
  };
}
