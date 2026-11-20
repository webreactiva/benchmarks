import type Redis from 'ioredis';
import type { RateLimiter, RateLimitResult } from '../domain/ports.js';

/**
 * Token bucket distribuido. Todo el estado vive en Redis, de modo que el
 * límite se respeta entre todas las réplicas de la API (un límite en memoria
 * del proceso sería multiplicado por el número de instancias).
 *
 * Se calculan los tokens en mili-tokens (enteros) porque Redis convierte los
 * números de Lua a enteros al pasarlos como argumentos.
 */
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillPerSecond = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local nowMs = tonumber(ARGV[4])
local ttlMs = tonumber(ARGV[5])

local capacityMilli = capacity * 1000
local costMilli = cost * 1000

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  tokens = capacityMilli
  ts = nowMs
end

local elapsed = nowMs - ts
if elapsed < 0 then elapsed = 0 end
tokens = tokens + (elapsed * refillPerSecond)
if tokens > capacityMilli then tokens = capacityMilli end

local allowed = 0
if tokens >= costMilli then
  tokens = tokens - costMilli
  allowed = 1
end

local retryAfterMs = 0
if allowed == 0 then
  retryAfterMs = math.ceil((costMilli - tokens) / refillPerSecond)
end

redis.call('HSET', key, 'tokens', tokens, 'ts', nowMs)
redis.call('PEXPIRE', key, ttlMs)

return { allowed, tostring(tokens), tostring(retryAfterMs), tostring(capacity) }
`;

export class RedisRateLimiter implements RateLimiter {
  private readonly redis: Redis;
  private readonly capacity: number;
  private readonly refillPerSecond: number;

  constructor(redis: Redis, capacity: number, refillPerSecond: number) {
    this.redis = redis;
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.redis.defineCommand('tokenBucket', { numberOfKeys: 1, lua: TOKEN_BUCKET_SCRIPT });
  }

  async consume(key: string, cost = 1): Promise<RateLimitResult> {
    const nowMs = Date.now();
    const ttlMs = Math.max(1_000, Math.ceil((this.capacity / this.refillPerSecond) * 2_000));
    const result = (await this.redis.tokenBucket(
      `ratelimit:${key}`,
      this.capacity,
      this.refillPerSecond,
      cost,
      nowMs,
      ttlMs,
    )) as [number, string, string, string];

    const allowed = Number(result[0]) === 1;
    const tokensMilli = Number(result[1]);
    const retryAfterMs = Number(result[2]);
    return {
      allowed,
      limit: Number(result[3]),
      remaining: Math.max(0, Math.floor(tokensMilli / 1000)),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }
}

/** Limitador en proceso: degradación elegante si Redis no responde. */
export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; updatedAt: number }>();
  private readonly capacity: number;
  private readonly refillPerSecond: number;

  constructor(capacity: number, refillPerSecond: number) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
  }

  async consume(key: string, cost = 1): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };
    const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSeconds * this.refillPerSecond);
    bucket.updatedAt = now;

    let allowed = true;
    if (bucket.tokens < cost) {
      allowed = false;
    } else {
      bucket.tokens -= cost;
    }
    this.buckets.set(key, bucket);

    return {
      allowed,
      limit: this.capacity,
      remaining: Math.floor(bucket.tokens),
      retryAfterSeconds: allowed
        ? 0
        : Math.max(1, Math.ceil((cost - bucket.tokens) / this.refillPerSecond)),
    };
  }
}
