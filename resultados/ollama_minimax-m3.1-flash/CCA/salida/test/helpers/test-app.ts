import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { loadConfig, type AppConfig } from '../../src/config.js';
import { CartService } from '../../src/application/cart-service.js';
import { buildApp } from '../../src/http/app.js';
import { MemoryCatalog } from '../../src/infrastructure/catalog.js';
import type { Cart } from '../../src/domain/cart.js';
import { LruCache } from '../../src/infrastructure/lru-cache.js';
import { RedisCartRepository } from '../../src/infrastructure/redis-cart-repository.js';
import { RedisEventPublisher } from '../../src/infrastructure/redis-event-publisher.js';
import { RedisIdempotencyStore } from '../../src/infrastructure/redis-idempotency-store.js';
import { MemoryRateLimiter, RedisRateLimiter } from '../../src/infrastructure/rate-limit.js';
import { createRedisClient } from '../../src/infrastructure/redis.js';

export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6399';

export interface TestApp {
  app: FastifyInstance;
  config: AppConfig;
  redis: Redis;
  close: () => Promise<void>;
}

export async function createTestApp(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): Promise<TestApp> {
  const config = loadConfig({
    NODE_ENV: 'test',
    REDIS_URL: TEST_REDIS_URL,
    REDIS_KEY_PREFIX: `test:${randomUUID().slice(0, 8)}:`,
    RATE_LIMIT_ENABLED: 'false',
    CACHE_TTL_MS: '0',
    LOG_LEVEL: 'error',
    ...overrides,
  } as NodeJS.ProcessEnv);

  const redis = createRedisClient(config, 'test');
  const repository = new RedisCartRepository(redis, config);
  const publisher = new RedisEventPublisher(redis, 'events:cart', config.events.streamMaxLen);
  const idempotency = new RedisIdempotencyStore(redis);
  const rateLimiter = new RedisRateLimiter(
    redis,
    config.rateLimit.capacity,
    config.rateLimit.refillPerSecond,
  );
  const cache = new LruCache<Cart>(config.cache.maxEntries, config.cache.ttlMs);

  const service = new CartService({
    repository,
    catalog: new MemoryCatalog(),
    publisher,
    config,
    cache,
  });

  const app = await buildApp({ config, service, idempotency, rateLimiter });

  return {
    app,
    config,
    redis,
    close: async () => {
      await app.close();
      await redis.quit();
    },
  };
}

export function memoryRateLimiter(capacity = 5, refillPerSecond = 1) {
  return new MemoryRateLimiter(capacity, refillPerSecond);
}
