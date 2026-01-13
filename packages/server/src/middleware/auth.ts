import { createMiddleware } from 'hono/factory';
import { timingSafeEqual } from 'crypto';

const FLUX_API_KEY = process.env.FLUX_API_KEY;

// Timing-safe string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare against itself to maintain constant time
    timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Auth middleware for Flux server.
 * - GET/HEAD requests are public (readonly)
 * - All other methods require Bearer token matching FLUX_API_KEY
 * - If FLUX_API_KEY is not set, all requests are allowed (dev mode)
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  // Allow all requests if no API key configured (dev mode)
  if (!FLUX_API_KEY) {
    return next();
  }

  // GET and HEAD are public (readonly)
  if (c.req.method === 'GET' || c.req.method === 'HEAD') {
    return next();
  }

  // Check Bearer token for write operations
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || !safeCompare(token, FLUX_API_KEY)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
});
