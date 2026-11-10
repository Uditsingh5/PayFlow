import { Redis } from 'ioredis';
import env from '../config/env.js';

let redisInstance: Redis | null = null;
let isRedisAvailable = false;

export function getRedisClient(): Redis | null {
  if (redisInstance) {
    return redisInstance;
  }

  try {
    redisInstance = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => {
        if (times > 3) {
          isRedisAvailable = false;
          return null;
        }
        return Math.min(times * 100, 1000);
      },
    });

    redisInstance.on('connect', () => {
      isRedisAvailable = true;
    });

    redisInstance.on('error', (err: Error) => {
      isRedisAvailable = false;
      if (env.NODE_ENV !== 'test') {
        console.warn('Redis connection error (failing open):', err.message);
      }
    });

    redisInstance.connect().catch(() => {
      isRedisAvailable = false;
    });

    return redisInstance;
  } catch {
    isRedisAvailable = false;
    return null;
  }
}

export function isRedisConnected(): boolean {
  return isRedisAvailable && redisInstance?.status === 'ready';
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client || !isRedisConnected()) {
    return null;
  }
  try {
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  const client = getRedisClient();
  if (!client || !isRedisConnected()) {
    return;
  }
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Fail silently
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const client = getRedisClient();
  if (!client || !isRedisConnected()) {
    return;
  }
  try {
    await client.del(key);
  } catch {
    // Fail silently
  }
}
