import type { DomainEvent } from "../domain/events.js";
import type { EventBus } from "../application/ports.js";

/**
 * Simple in-memory bus: keeps the published events (useful for tests and
 * local debugging) and optionally logs them. Swap for Kafka/RabbitMQ/SQS
 * or a transactional outbox when running multiple instances.
 */
export class InMemoryEventBus implements EventBus {
  readonly published: DomainEvent[] = [];

  constructor(private readonly logger?: (event: DomainEvent) => void) {}

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.published.push(event);
      this.logger?.(event);
    }
  }
}
