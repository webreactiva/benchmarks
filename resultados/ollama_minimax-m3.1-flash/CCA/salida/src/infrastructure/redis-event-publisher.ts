import type Redis from 'ioredis';
import type { DomainEvent, EventPublisher } from '../domain/ports.js';

/**
 * Publicador de eventos sobre Redis Streams.
 *
 * Los eventos ligados a una mutación de carrito se escriben dentro del propio
 * script Lua (outbox transaccional). Este publicador se usa para eventos que
 * no accompanyState mutaciones (p. ej. `cart.viewed` o señales operativas) y
 * para consumers que leen del stream con grupos de consumidores.
 */
export class RedisEventPublisher implements EventPublisher {
  private readonly redis: Redis;
  private readonly streamKey: string;
  private readonly maxLen: number;

  constructor(redis: Redis, streamKey = 'events:cart', maxLen = 100_000) {
    this.redis = redis;
    this.streamKey = streamKey;
    this.maxLen = maxLen;
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.redis.xadd(
      this.streamKey,
      'MAXLEN',
      '~',
      this.maxLen,
      '*',
      'type',
      event.type,
      'id',
      event.id,
      'cartId',
      event.cartId,
      'version',
      String(event.version),
      'occurredAt',
      event.occurredAt,
      'actorId',
      event.actorId ?? '',
      'data',
      JSON.stringify(event.payload),
    );
  }
}
