import type {
  Cache,
  IdempotencyClaim,
  IdempotencyRecord,
  IdempotencyStore,
  Logger,
} from '@cart/core';
import { CLAIM_IDEMPOTENCY_SCRIPT } from './scripts.js';
import type { RedisClient } from './connection.js';

export class RedisCache implements Cache {
  constructor(
    private readonly redis: RedisClient,
    private readonly prefix: string,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(`${this.prefix}cache:${key}`);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.redis.set(`${this.prefix}cache:${key}`, JSON.stringify(value), {
      EX: Math.max(1, Math.ceil(ttlMs / 1000)),
    });
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}cache:${key}`);
  }
}

/**
 * Redis backed idempotency store.
 *
 * The key is claimed atomically before the operation runs, so two concurrent
 * requests with the same `Idempotency-Key` can never execute the operation
 * twice.
 */
export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly redis: RedisClient,
    private readonly prefix: string,
    private readonly logger: Logger,
  ) {}

  private key(key: string): string {
    return `${this.prefix}idem:{${key}}`;
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    const raw = await this.redis.get(this.key(key));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as IdempotencyRecord;
    } catch (error) {
      this.logger.warn('invalid idempotency record', { key, error: String(error) });
      return null;
    }
  }

  async put(record: IdempotencyRecord, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.key(record.key), JSON.stringify(record), {
      EX: Math.max(1, ttlSeconds),
    });
  }

  async claim(key: string, requestHash: string, ttlSeconds: number): Promise<IdempotencyClaim> {
    const placeholder: IdempotencyRecord = {
      key,
      requestHash,
      statusCode: 0,
      body: null,
      createdAt: new Date().toISOString(),
    };

    const result = (await this.redis.eval(CLAIM_IDEMPOTENCY_SCRIPT, {
      keys: [this.key(key)],
      arguments: [requestHash, JSON.stringify(placeholder), String(Math.max(1, ttlSeconds))],
    })) as string[];

    const status = result[0];
    if (status === 'claimed') return 'claimed';
    if (status === 'replay') return 'replay';
    return 'conflict';
  }
}
