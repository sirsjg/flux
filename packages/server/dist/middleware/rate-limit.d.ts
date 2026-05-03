type RateLimitConfig = {
    windowMs: number;
    maxRequests: number;
};
/**
 * Simple in-memory rate limiter middleware
 */
export declare function rateLimit(config: RateLimitConfig): import("hono").MiddlewareHandler<any, string, {}, Response & import("hono").TypedResponse<{
    error: string;
}, 429, "json">>;
export {};
