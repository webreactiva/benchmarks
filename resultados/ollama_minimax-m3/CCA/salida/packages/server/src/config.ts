import type { CartPolicies } from '@cart/core';
import { defaultCartPolicies } from '@cart/core';

export type CatalogSource = 'seed' | 'http';

export interface RedisConfig {
  /** `null` disables Redis: the app runs with the in-memory adapters. */
  readonly url: string | null;
  readonly keyPrefix: string;
  readonly connectTimeoutMs: number;
}

export interface PricingConfig {
  readonly currency: string;
  readonly taxRate: number;
  readonly shippingFlatAmount: number;
  readonly freeShippingThreshold: number | null;
}

export interface CatalogConfig {
  readonly source: CatalogSource;
  readonly url: string | null;
  readonly cacheTtlMs: number;
}

export interface AppConfig {
  readonly env: string;
  readonly host: string;
  readonly port: number;
  readonly logLevel: string;
  readonly bodyLimitBytes: number;
  readonly redis: RedisConfig;
  readonly cart: CartPolicies;
  readonly pricing: PricingConfig;
  readonly catalog: CatalogConfig;
  readonly idempotencyTtlSeconds: number;
  readonly writeRetries: number;
  readonly rateLimit: { readonly max: number; readonly timeWindowMs: number };
  readonly corsOrigin: string;
  readonly shutdownTimeoutMs: number;
}

const readString = (env: NodeJS.ProcessEnv, key: string, fallback: string): string => {
  const value = env[key];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
};

const readNumber = (env: NodeJS.ProcessEnv, key: string, fallback: number): number => {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, received "${raw}"`);
  }
  return parsed;
};

const readOptionalNumber = (env: NodeJS.ProcessEnv, key: string): number | null => {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, received "${raw}"`);
  }
  return parsed;
};

const readBoolean = (env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean => {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const envName = readString(env, 'NODE_ENV', 'development');
  const currency = readString(env, 'CURRENCY', 'EUR').toUpperCase();
  const redisUrl = readString(env, 'REDIS_URL', '');

  const policies: CartPolicies = {
    ...defaultCartPolicies,
    maxQuantityPerLine: readNumber(
      env,
      'MAX_QUANTITY_PER_LINE',
      defaultCartPolicies.maxQuantityPerLine,
    ),
    maxDistinctLines: readNumber(env, 'MAX_DISTINCT_LINES', defaultCartPolicies.maxDistinctLines),
    maxUnitsPerCart: readNumber(env, 'MAX_UNITS_PER_CART', defaultCartPolicies.maxUnitsPerCart),
    ttlSeconds: readNumber(env, 'CART_TTL_SECONDS', defaultCartPolicies.ttlSeconds),
  };

  const catalogSource = readString(env, 'CATALOG_SOURCE', 'seed').toLowerCase() as CatalogSource;
  if (catalogSource !== 'seed' && catalogSource !== 'http') {
    throw new Error(`CATALOG_SOURCE must be "seed" or "http", received "${catalogSource}"`);
  }

  const freeShippingThreshold = readOptionalNumber(env, 'FREE_SHIPPING_THRESHOLD');

  return {
    env: envName,
    host: readString(env, 'HOST', '0.0.0.0'),
    port: readNumber(env, 'PORT', 3000),
    logLevel: readString(env, 'LOG_LEVEL', envName === 'test' ? 'silent' : 'info'),
    bodyLimitBytes: readNumber(env, 'BODY_LIMIT_BYTES', 256 * 1024),
    redis: {
      url: redisUrl === '' ? null : redisUrl,
      keyPrefix: readString(env, 'REDIS_KEY_PREFIX', 'cart:'),
      connectTimeoutMs: readNumber(env, 'REDIS_CONNECT_TIMEOUT_MS', 5000),
    },
    cart: policies,
    pricing: {
      currency,
      taxRate: readNumber(env, 'TAX_RATE', 0.21),
      shippingFlatAmount: readNumber(env, 'SHIPPING_FLAT_AMOUNT', 499),
      freeShippingThreshold,
    },
    catalog: {
      source: catalogSource,
      url: readString(env, 'CATALOG_URL', '') || null,
      cacheTtlMs: readNumber(env, 'CATALOG_CACHE_TTL_MS', 30_000),
    },
    idempotencyTtlSeconds: readNumber(env, 'IDEMPOTENCY_TTL_SECONDS', 86_400),
    writeRetries: readNumber(env, 'CART_WRITE_RETRIES', 5),
    rateLimit: {
      max: readNumber(env, 'RATE_LIMIT_MAX', 300),
      timeWindowMs: readNumber(env, 'RATE_LIMIT_WINDOW_MS', 60_000),
    },
    corsOrigin: readString(env, 'CORS_ORIGIN', '*'),
    shutdownTimeoutMs: readNumber(env, 'SHUTDOWN_TIMEOUT_MS', 10_000),
  };
}

export const isProduction = (config: AppConfig): boolean => config.env === 'production';
export const readBooleanEnv = readBoolean;
