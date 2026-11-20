import type { DomainEvent, EventPublisher, EventSubscriber, Logger } from '@cart/core';
import type { RedisClient } from './connection.js';

export interface RedisEventBusOptions {
  readonly keyPrefix: string;
  readonly channel?: string;
  readonly outboxSize?: number;
}

/**
 * Event bus on top of Redis pub/sub plus a durable outbox list.
 *
 * - Pub/sub fans the events out to every replica (used to push live updates
 *   to the browsers through SSE).
 * - The outbox list keeps the events of the last minutes so a subscriber that
 *   was temporarily disconnected can replay them.
 */
export class RedisEventBus implements EventPublisher, EventSubscriber {
  private readonly channel: string;
  private readonly outboxKey: string;
  private readonly outboxSize: number;
  private readonly handlers = new Set<(event: DomainEvent) => void>();
  private subscribed = false;

  constructor(
    private readonly redis: RedisClient,
    private readonly publisher: RedisClient,
    private readonly subscriber: RedisClient,
    options: RedisEventBusOptions,
    private readonly logger: Logger,
  ) {
    this.channel = options.channel ?? `${options.keyPrefix}events`;
    this.outboxKey = `${options.keyPrefix}outbox:events`;
    this.outboxSize = options.outboxSize ?? 1000;
  }

  async publish(event: DomainEvent): Promise<void> {
    const payload = JSON.stringify(event);
    await this.publisher.publish(this.channel, payload);
    await this.redis.rPush(this.outboxKey, payload);
    await this.redis.lTrim(this.outboxKey, -this.outboxSize, -1);
  }

  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  async subscribe(handler: (event: DomainEvent) => void): Promise<() => void> {
    this.handlers.add(handler);
    if (!this.subscribed) {
      await this.subscriber.subscribe(this.channel, (message: string) => this.dispatch(message));
      this.subscribed = true;
    }

    return async () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0 && this.subscribed) {
        await this.subscriber.unsubscribe(this.channel).catch(() => undefined);
        this.subscribed = false;
      }
    };
  }

  private dispatch(message: string): void {
    let event: DomainEvent;
    try {
      event = JSON.parse(message) as DomainEvent;
    } catch (error) {
      this.logger.warn('invalid event received', { error: String(error) });
      return;
    }
    for (const handler of [...this.handlers]) {
      try {
        handler(event);
      } catch (error) {
        this.logger.warn('event handler failed', { error: String(error) });
      }
    }
  }
}
