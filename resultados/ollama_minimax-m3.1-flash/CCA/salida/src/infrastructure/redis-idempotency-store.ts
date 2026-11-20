import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import type { IdempotencyStore, StoredResponse } from '../domain/ports.js';

const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

/**
 * Almacén de idempotencia respaldado por Redis.
 *
 * Permite que un cliente reintente una mutación (tiempo de red inestable,
 * reintentos de SDK, doble clic) sin duplicar efectos. La clave se guarda
 * junto con la respuesta completa y se reproduce tal cual.
 */
export class RedisIdempotencyStore implements IdempotencyStore {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
    this.redis.defineCommand('releaseLock', { numberOfKeys: 1, lua: RELEASE_SCRIPT });
  }

  private resultKey(key: string): string {
    return `idem:${key}`;
  }

  private lockKey(key: string): string {
    return `idemlock:${key}`;
  }

  async get(key: string): Promise<StoredResponse | null> {
    const raw = await this.redis.get(this.resultKey(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredResponse;
    } catch {
      return null;
    }
  }

  async lock(key: string, token: string, ttlSeconds: number): Promise<boolean> {
    const res = await this.redis.set(this.lockKey(key), token, 'PX', ttlSeconds * 1000, 'NX');
    return res === 'OK';
  }

  async release(key: string, token: string): Promise<void> {
    await this.redis.releaseLock(this.lockKey(key), token);
  }

  async save(key: string, response: StoredResponse, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      this.resultKey(key),
      JSON.stringify(response),
      'EX',
      ttlSeconds,
    );
  }

  async waitForResult(key: string, timeoutMs: number): Promise<StoredResponse | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const stored = await this.get(key);
      if (stored) return stored;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return null;
  }
}

export function newIdempotencyToken(): string {
  return randomUUID();
}
