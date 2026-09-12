import { env } from '@/config/env';
import { getRedis } from '@/config/redis';
import { logger } from '@/config/logger';

type MemoryEntry = { value: string; expiresAt: number };

/**
 * Thin cache facade backed by Redis, with an in-process LRU-ish fallback so the
 * API keeps working (and tests stay hermetic) when Redis is not reachable.
 */
export class CacheService {
  private readonly memory = new Map<string, MemoryEntry>();
  private readonly maxMemoryEntries = 1000;

  async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (redis?.status === 'ready') {
      try {
        const raw = await redis.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch (error) {
        logger.warn(`Cache get failed for ${key}: ${(error as Error).message}`);
      }
    }
    return this.getFromMemory<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds = env.CACHE_TTL_SECONDS): Promise<void> {
    const payload = JSON.stringify(value);
    const redis = getRedis();
    if (redis?.status === 'ready') {
      try {
        await redis.set(key, payload, 'EX', ttlSeconds);
        return;
      } catch (error) {
        logger.warn(`Cache set failed for ${key}: ${(error as Error).message}`);
      }
    }
    this.setInMemory(key, payload, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    const redis = getRedis();
    if (redis?.status === 'ready') {
      try {
        await redis.del(key);
      } catch (error) {
        logger.warn(`Cache del failed for ${key}: ${(error as Error).message}`);
      }
    }
    this.memory.delete(key);
  }

  /** Invalidates every key under a logical namespace, e.g. `tenant:123:units`. */
  async delByPrefix(prefix: string): Promise<void> {
    const redis = getRedis();
    if (redis?.status === 'ready') {
      try {
        const stream = redis.scanStream({ match: `${prefix}*`, count: 200 });
        for await (const keys of stream as AsyncIterable<string[]>) {
          if (keys.length) await redis.del(...keys);
        }
      } catch (error) {
        logger.warn(`Cache prefix invalidation failed for ${prefix}: ${(error as Error).message}`);
      }
    }
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
  }

  async remember<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  private setInMemory(key: string, value: string, ttlSeconds: number): void {
    if (this.memory.size >= this.maxMemoryEntries) {
      const oldestKey = this.memory.keys().next().value;
      if (oldestKey) this.memory.delete(oldestKey);
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

export const cacheService = new CacheService();
