import type { Hono } from 'hono';
import type { AuthContext } from './middleware/auth.js';
/**
 * Register sync API routes on the Hono app.
 *
 * Routes:
 *   GET  /api/sync/status  — Current sync status (node role, peers, sequence)
 *   GET  /api/sync/pull    — Pull changes since a given sequence number
 *   POST /api/sync/push    — Push changes from a remote peer
 *   POST /api/sync/discover — Trigger peer discovery (Tailscale or manual)
 */
export declare function registerSyncRoutes(app: Hono<{
    Variables: {
        auth: AuthContext;
    };
}>): void;
