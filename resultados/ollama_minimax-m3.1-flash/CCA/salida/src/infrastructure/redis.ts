import Redis, { type RedisOptions } from 'ioredis';
import type { AppConfig } from '../config.js';

export interface RedisClientOptions {
  /**
   * Timeout por comando. Los comandos bloqueantes (XREADGROUP) necesitan un
   * margen por encima del tiempo de bloqueo, o ioredis aborta la lectura.
   */
  commandTimeoutMs?: number;
  blockingTimeoutMs?: number;
}

export function createRedisClient(
  config: AppConfig,
  role = 'default',
  options: RedisClientOptions = {},
): Redis {
  const commandTimeoutMs = options.commandTimeoutMs ?? config.redis.commandTimeoutMs;
  const redisOptions: RedisOptions = {
    keyPrefix: config.redis.keyPrefix,
    connectTimeout: config.redis.connectTimeoutMs,
    commandTimeout: commandTimeoutMs,
    ...(options.blockingTimeoutMs ? { blockingTimeout: options.blockingTimeoutMs } : {}),
    maxRetriesPerRequest: config.redis.maxRetries,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (times: number) => {
      if (times > 10) return null;
      return Math.min(times * 100, 2_000);
    },
    reconnectOnError: (err: Error) => {
      if (err.message.includes('READONLY')) return 2;
      return false;
    },
    ...(config.redis.tls ? { tls: {} } : {}),
  };

  const client = new Redis(config.redis.url, redisOptions);
  client.on('error', (err: Error) => {
    if (role === 'default') {
      console.error('[redis] error:', err.message);
    }
  });
  return client;
}
