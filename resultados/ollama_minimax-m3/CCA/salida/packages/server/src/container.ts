import {
  CachedProductCatalog,
  InMemoryCartRepository,
  InMemoryEventBus,
  InMemoryIdempotencyStore,
  InMemoryPricingRules,
  InMemoryProductCatalog,
  InMemoryCache,
  InMemoryStockManager,
  CartService,
  systemClock,
  uuidGenerator,
  money,
  type Cache,
  type CartRepository,
  type EventPublisher,
  type EventSubscriber,
  type IdempotencyStore,
  type Logger,
  type PricingRulesProvider,
  type ProductCatalog,
  type ShippingPolicy,
  type StockManager,
} from '@cart/core';
import type { AppConfig } from './config.js';
import { createLogger } from './observability/logger.js';
import { MetricsRegistry } from './observability/metrics.js';
import {
  createRedisConnection,
  sanitizePrefix,
  type RedisConnection,
} from './adapters/redis/connection.js';
import { RedisCartRepository } from './adapters/redis/cart-repository.js';
import { RedisStockManager } from './adapters/redis/stock.js';
import { RedisCache, RedisIdempotencyStore } from './adapters/redis/cache.js';
import { RedisEventBus } from './adapters/redis/event-bus.js';
import { HttpProductCatalog } from './adapters/http/catalog-client.js';

export interface Container {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly metrics: MetricsRegistry;
  readonly cartService: CartService;
  readonly catalog: ProductCatalog;
  readonly events: EventPublisher & EventSubscriber;
  readonly idempotency: IdempotencyStore;
  readonly stock: StockManager;
  readonly readiness: () => Promise<Record<string, boolean>>;
  readonly close: () => Promise<void>;
}

/**
 * Composition root.
 *
 * Every adapter is chosen here and nowhere else: the domain only knows the
 * ports, so the very same code runs with the in-memory adapters (single node
 * demo, tests) or with Redis (horizontally scaled deployment).
 */
export async function createContainer(config: AppConfig): Promise<Container> {
  const logger = createLogger(config);
  const metrics = new MetricsRegistry();
  const clock = systemClock;
  const ids = uuidGenerator;

  let redis: RedisConnection | null = null;
  let carts: CartRepository;
  let stock: StockManager;
  let cache: Cache;
  let idempotency: IdempotencyStore;
  let events: EventPublisher & EventSubscriber;

  const baseCatalog: ProductCatalog =
    config.catalog.source === 'http' && config.catalog.url
      ? new HttpProductCatalog(config.catalog.url)
      : new InMemoryProductCatalog(undefined, config.pricing.currency);

  if (config.redis.url) {
    redis = await createRedisConnection(config.redis, logger);
    const prefix = sanitizePrefix(config.redis.keyPrefix);

    carts = new RedisCartRepository(redis.client, {
      keyPrefix: prefix,
      ttlSeconds: config.cart.ttlSeconds,
      logger,
    });
    stock = new RedisStockManager(redis.client, {
      keyPrefix: prefix,
      reservationTtlSeconds: 900,
      ids,
      logger,
    });
    cache = new RedisCache(redis.client, prefix);
    idempotency = new RedisIdempotencyStore(redis.client, prefix, logger);
    events = new RedisEventBus(
      redis.client,
      redis.publisher,
      redis.subscriber,
      {
        keyPrefix: prefix,
      },
      logger,
    );

    logger.info('redis adapters enabled', { url: config.redis.url });
  } else {
    carts = new InMemoryCartRepository();
    stock = new InMemoryStockManager({}, ids);
    cache = new InMemoryCache();
    idempotency = new InMemoryIdempotencyStore();
    events = new InMemoryEventBus();

    logger.warn('REDIS_URL is not set: running with the in-memory adapters (single node only)');
  }

  const catalog = new CachedProductCatalog(baseCatalog, cache, config.catalog.cacheTtlMs);
  const rules: PricingRulesProvider = new InMemoryPricingRules();

  const shipping: ShippingPolicy = {
    flatAmount: money(config.pricing.shippingFlatAmount, config.pricing.currency),
    ...(config.pricing.freeShippingThreshold !== null
      ? { freeAbove: money(config.pricing.freeShippingThreshold, config.pricing.currency) }
      : {}),
    taxRate: config.pricing.taxRate,
  };

  const cartService = new CartService(
    { carts, catalog, rules, stock, events, clock, ids },
    {
      policies: config.cart,
      shipping,
      currency: config.pricing.currency,
      writeRetries: config.writeRetries,
      logger,
    },
  );

  // Seed the stock levels with the catalogue defaults so the checkout flow
  // works out of the box (only for the in-memory catalog).
  await seedStock(baseCatalog, stock, redis);

  return {
    config,
    logger,
    metrics,
    cartService,
    catalog,
    events,
    idempotency,
    stock,
    readiness: async () => {
      const checks: Record<string, boolean> = { catalog: true };
      if (redis) {
        try {
          checks.redis = await redis.client.ping().then((reply) => reply === 'PONG');
        } catch {
          checks.redis = false;
        }
      } else {
        checks.redis = true;
      }
      return checks;
    },
    close: async () => {
      if (redis) await redis.close();
    },
  };
}

async function seedStock(
  catalog: ProductCatalog,
  stock: StockManager,
  redis: RedisConnection | null,
): Promise<void> {
  if (!(catalog instanceof InMemoryProductCatalog)) return;

  const products = await catalog.list({ limit: 200 });
  const levels: Record<string, number> = {};
  for (const product of products) {
    levels[product.id] = product.stock ?? 100;
  }

  if (redis && stock instanceof RedisStockManager) {
    await stock.seedStock(levels);
    return;
  }
  if (stock instanceof InMemoryStockManager) {
    for (const [productId, quantity] of Object.entries(levels)) {
      stock.setStock(productId, quantity);
    }
  }
}
