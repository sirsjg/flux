import { createMiddleware } from 'hono/factory';
// In-memory store for rate limiting
const requestCounts = new Map();
// Cleanup old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of requestCounts) {
        if (value.resetAt < now) {
            requestCounts.delete(key);
        }
    }
}, 60000); // Cleanup every minute
/**
 * Simple in-memory rate limiter middleware
 */
export function rateLimit(config) {
    return createMiddleware(async (c, next) => {
        // Use IP as key (or X-Forwarded-For if behind proxy)
        const ip = c.req.header('X-Forwarded-For')?.split(',')[0].trim() ||
            c.req.header('X-Real-IP') ||
            'unknown';
        const key = `${ip}:${c.req.path}`;
        const now = Date.now();
        let entry = requestCounts.get(key);
        if (!entry || entry.resetAt < now) {
            entry = { count: 0, resetAt: now + config.windowMs };
            requestCounts.set(key, entry);
        }
        entry.count++;
        if (entry.count > config.maxRequests) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            c.header('Retry-After', String(retryAfter));
            return c.json({ error: 'Too many requests' }, 429);
        }
        return next();
    });
}
