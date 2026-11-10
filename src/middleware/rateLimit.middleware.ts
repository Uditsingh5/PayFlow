import type { NextFunction, Request, Response } from 'express';
import { getRedisClient, isRedisConnected } from '../lib/redis.js';

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix?: string;
}

export function rateLimiter(options: RateLimitOptions) {
  const { windowSeconds, maxRequests, keyPrefix = 'rl' } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const client = getRedisClient();

    // Fail open safely if Redis is not connected
    if (!client || !isRedisConnected()) {
      next();
      return;
    }

    try {
      const identifier = req.user?.id ?? req.ip ?? 'unknown';
      const key = `${keyPrefix}:${identifier}`;

      const current = await client.incr(key);
      if (current === 1) {
        await client.expire(key, windowSeconds);
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

      if (current > maxRequests) {
        res.status(429).json({
          status: 'error',
          message: 'Too many requests. Please try again later.',
        });
        return;
      }

      next();
    } catch {
      // If redis errors during increment, fail open without dropping the request
      next();
    }
  };
}

