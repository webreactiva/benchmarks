import pino, { type Logger } from 'pino';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from './config.js';
import { CartService } from './application/cart-service.js';
import type { Cart } from './domain/cart.js';
import { buildApp, createMetrics } from './http/app.js';
import { HttpCatalog, MemoryCatalog } from './infrastructure/catalog.js';
import { LruCache } from './infrastructure/lru-cache.js';
import { MemoryCartRepository } from './infrastructure/memory-cart-repository.js';
import { RedisCartRepository } from './infrastructure/redis-cart-repository.js';
import { RedisEventPublisher } from './infrastructure/redis-event-publisher.js';
import { RedisIdempotencyStore } from './infrastructure/redis-idempotency-store.js';
import { MemoryRateLimiter, RedisRateLimiter } from './infrastructure/rate-limit.js';
import { ResilientCartRepository } from './infrastructure/resilient-repository.js';
import { createRedisClient } from './infrastructure/redis.js';

export interface Runtime {
  app: FastifyInstance;
  logger: Logger;
  close: () => Promise<void>;
  redisHealthy: () => boolean;
}

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.logLevel,
    base: { service: 'carrito-api' },
    ...(config.logPretty ? { transport: { target: 'pino-pretty' } } : {}),
  });
}

/**
 * Cableado de la aplicación: Redis como fuente de verdad, caché local para
 * lecturas, rate limiting distribuido, idempotencia y outbox transaccional.
 */
export async function createRuntime(config: AppConfig): Promise<Runtime> {
  const logger = createLogger(config);
  const redis = createRedisClient(config);

  const metrics = createMetrics();

  const redisRepository = new RedisCartRepository(redis, config);
  const memoryRepository = new MemoryCartRepository(config);
  const repository = new ResilientCartRepository(redisRepository, memoryRepository, logger);

  const catalog =
    config.catalog.mode === 'http' && config.catalog.url
      ? new HttpCatalog(config.catalog.url, config.catalog.timeoutMs)
      : new MemoryCatalog();

  const publisher = new RedisEventPublisher(redis, 'events:cart', config.events.streamMaxLen);
  const idempotency = new RedisIdempotencyStore(redis);
  const rateLimiter = config.rateLimit.enabled
    ? new RedisRateLimiter(redis, config.rateLimit.capacity, config.rateLimit.refillPerSecond)
    : new MemoryRateLimiter(config.rateLimit.capacity, config.rateLimit.refillPerSecond);

  const cache = new LruCache<Cart>(config.cache.maxEntries, config.cache.ttlMs);

  const service = new CartService({
    repository,
    catalog,
    publisher,
    config,
    cache,
    logger,
  });

  const app = await buildApp({
    config,
    service,
    idempotency,
    rateLimiter,
    metrics,
    readiness: async () => redis.status === 'ready' || redis.status === 'connecting',
  });

  app.log.info(
    {
      env: config.env,
      port: config.port,
      redis: config.redis.url,
      catalog: config.catalog.mode,
    },
    'API de carrito iniciada',
  );

  return {
    app,
    logger,
    redisHealthy: () => redis.status === 'ready',
    close: async () => {
      await app.close();
      redis.disconnect();
    },
  };
}
