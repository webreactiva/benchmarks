import { createClient } from 'redis';
import type { Logger } from '@cart/core';
import type { RedisConfig } from '../../config.js';

/** The concrete node-redis client type (keeps the module generics). */
export type RedisClient = ReturnType<typeof createClient>;

export interface RedisConnection {
  readonly client: RedisClient;
  readonly publisher: RedisClient;
  readonly subscriber: RedisClient;
  isReady(): boolean;
  close(): Promise<void>;
}

/**
 * One Redis connection is used for regular commands and two extra ones are
 * dedicated to publishing/subscribing (a subscribed connection cannot run
 * regular commands in RESP2).
 */
export async function createRedisConnection(
  config: RedisConfig,
  logger: Logger,
): Promise<RedisConnection> {
  if (!config.url) {
    throw new Error('REDIS_URL is required to create a Redis connection');
  }

  const options = {
    url: config.url,
    socket: {
      connectTimeout: config.connectTimeoutMs,
      reconnectStrategy: (retries: number) => {
        if (retries > 10) return new Error('Redis reconnect limit reached');
        return Math.min(retries * 100, 2000);
      },
    },
  };

  const client = createClient(options);
  client.on('error', (error: Error) =>
    logger.error('redis client error', { error: error.message }),
  );
  client.on('reconnecting', () => logger.warn('redis reconnecting'));

  await client.connect();

  const publisher = client.duplicate();
  publisher.on('error', (error: Error) =>
    logger.error('redis publisher error', { error: error.message }),
  );
  await publisher.connect();

  const subscriber = client.duplicate();
  subscriber.on('error', (error: Error) =>
    logger.error('redis subscriber error', { error: error.message }),
  );
  await subscriber.connect();

  return {
    client,
    publisher,
    subscriber,
    isReady: () => client.isReady,
    close: async () => {
      await Promise.allSettled([client.quit(), publisher.quit(), subscriber.quit()]);
    },
  };
}

/** Removes the characters that would break the Redis Cluster hash tags. */
export const sanitizePrefix = (prefix: string): string => prefix.replace(/[{}]/g, '');
