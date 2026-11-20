import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),

  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  REDIS_KEY_PREFIX: z.string().default('cart:'),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(50).default(3_000),
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().min(50).default(2_000),
  REDIS_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
  REDIS_TLS: z.coerce.boolean().default(false),

  CART_TTL_SECONDS: z.coerce.number().int().min(60).default(60 * 60 * 24 * 14),
  CART_MAX_ITEMS: z.coerce.number().int().min(1).default(200),
  CART_MAX_QUANTITY_PER_LINE: z.coerce.number().int().min(1).default(99),
  CART_MAX_ACTIVE_PER_USER: z.coerce.number().int().min(1).default(5),

  CACHE_TTL_MS: z.coerce.number().int().min(0).default(2_000),
  CACHE_MAX_ENTRIES: z.coerce.number().int().min(1).default(10_000),

  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_CAPACITY: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_REFILL_PER_SECOND: z.coerce.number().int().min(1).default(20),

  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().min(1).default(60 * 60 * 24),

  SHIPPING_FLAT_CENTS: z.coerce.number().int().min(0).default(499),
  FREE_SHIPPING_THRESHOLD_CENTS: z.coerce.number().int().min(0).default(5_000),
  TAX_BPS: z.coerce.number().int().min(0).max(10_000).default(2_100),

  PROMO_RULES: z.string().default(
    '{"WELCOME10":{"type":"percent","bps":1000,"maxDiscountCents":2000},"SAVE5":{"type":"fixed","amountCents":500,"minSubtotalCents":3000}}',
  ),

  JWT_SECRET: z.string().min(8).default('dev-secret-change-me'),
  JWT_ISSUER: z.string().default('carrito-escalable'),

  CATALOG_MODE: z.enum(['memory', 'http']).default('memory'),
  CATALOG_URL: z.string().default(''),
  CATALOG_TIMEOUT_MS: z.coerce.number().int().min(50).default(1_500),

  /**
   * Emite un evento `cart.viewed` por cada lectura. Desactivado por defecto:
   * convertir cada lectura en una escritura penaliza la escalabilidad.
   */
  TRACK_VIEWS: z.coerce.boolean().default(false),

  WORKER_CONSUMER_GROUP: z.string().default('cart-events'),
  WORKER_CONSUMER_NAME: z.string().default('worker-1'),
  WORKER_BATCH_SIZE: z.coerce.number().int().min(1).default(50),
  WORKER_BLOCK_MS: z.coerce.number().int().min(1).default(2_000),

  OUTBOX_MAX_LEN: z.coerce.number().int().min(1).default(100_000),
  EVENTS_STREAM_MAX_LEN: z.coerce.number().int().min(1).default(100_000),
});

export type PromoRule =
  | { type: 'percent'; bps: number; maxDiscountCents?: number; minSubtotalCents?: number }
  | { type: 'fixed'; amountCents: number; minSubtotalCents?: number };

export interface PricingRules {
  shippingFlatCents: number;
  freeShippingThresholdCents: number;
  taxBps: number;
  promos: Record<string, PromoRule>;
  limits: {
    maxItems: number;
    maxQuantityPerLine: number;
  };
}

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: string;
  logPretty: boolean;
  redis: {
    url: string;
    keyPrefix: string;
    connectTimeoutMs: number;
    commandTimeoutMs: number;
    maxRetries: number;
    tls: boolean;
  };
  cart: {
    ttlSeconds: number;
    maxItems: number;
    maxQuantityPerLine: number;
    maxActivePerUser: number;
  };
  cache: {
    ttlMs: number;
    maxEntries: number;
  };
  rateLimit: {
    enabled: boolean;
    capacity: number;
    refillPerSecond: number;
  };
  idempotencyTtlSeconds: number;
  pricing: PricingRules;
  auth: {
    secret: string;
    issuer: string;
  };
  catalog: {
    mode: 'memory' | 'http';
    url: string;
    timeoutMs: number;
  };
  trackViews: boolean;
  worker: {
    consumerGroup: string;
    consumerName: string;
    batchSize: number;
    blockMs: number;
  };
  events: {
    streamMaxLen: number;
    outboxMaxLen: number;
  };
}

function parsePromos(raw: string): Record<string, PromoRule> {
  try {
    const parsed = JSON.parse(raw) as Record<string, PromoRule>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    throw new Error('PROMO_RULES no es JSON válido');
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${issues}`);
  }
  const e = parsed.data;

  if (e.NODE_ENV === 'production' && e.JWT_SECRET === 'dev-secret-change-me') {
    throw new Error('JWT_SECRET por defecto no permitido en producción');
  }

  return {
    env: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    logPretty: e.LOG_PRETTY,
    redis: {
      url: e.REDIS_URL,
      keyPrefix: e.REDIS_KEY_PREFIX,
      connectTimeoutMs: e.REDIS_CONNECT_TIMEOUT_MS,
      commandTimeoutMs: e.REDIS_COMMAND_TIMEOUT_MS,
      maxRetries: e.REDIS_MAX_RETRIES,
      tls: e.REDIS_TLS,
    },
    cart: {
      ttlSeconds: e.CART_TTL_SECONDS,
      maxItems: e.CART_MAX_ITEMS,
      maxQuantityPerLine: e.CART_MAX_QUANTITY_PER_LINE,
      maxActivePerUser: e.CART_MAX_ACTIVE_PER_USER,
    },
    cache: {
      ttlMs: e.CACHE_TTL_MS,
      maxEntries: e.CACHE_MAX_ENTRIES,
    },
    rateLimit: {
      enabled: e.RATE_LIMIT_ENABLED,
      capacity: e.RATE_LIMIT_CAPACITY,
      refillPerSecond: e.RATE_LIMIT_REFILL_PER_SECOND,
    },
    idempotencyTtlSeconds: e.IDEMPOTENCY_TTL_SECONDS,
    pricing: {
      shippingFlatCents: e.SHIPPING_FLAT_CENTS,
      freeShippingThresholdCents: e.FREE_SHIPPING_THRESHOLD_CENTS,
      taxBps: e.TAX_BPS,
      promos: parsePromos(e.PROMO_RULES),
      limits: {
        maxItems: e.CART_MAX_ITEMS,
        maxQuantityPerLine: e.CART_MAX_QUANTITY_PER_LINE,
      },
    },
    auth: {
      secret: e.JWT_SECRET,
      issuer: e.JWT_ISSUER,
    },
    catalog: {
      mode: e.CATALOG_MODE,
      url: e.CATALOG_URL,
      timeoutMs: e.CATALOG_TIMEOUT_MS,
    },
    trackViews: e.TRACK_VIEWS,
    worker: {
      consumerGroup: e.WORKER_CONSUMER_GROUP,
      consumerName: e.WORKER_CONSUMER_NAME,
      batchSize: e.WORKER_BATCH_SIZE,
      blockMs: e.WORKER_BLOCK_MS,
    },
    events: {
      streamMaxLen: e.EVENTS_STREAM_MAX_LEN,
      outboxMaxLen: e.OUTBOX_MAX_LEN,
    },
  };
}
