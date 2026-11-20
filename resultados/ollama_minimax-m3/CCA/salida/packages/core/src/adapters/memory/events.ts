import type { DomainEvent } from '../../domain/events.js';
import type { EventPublisher, EventSubscriber } from '../../application/ports.js';

/**
 * In-process event bus. The Redis implementation publishes to a channel so any
 * replica can react to the events of any other replica.
 */
export class InMemoryEventBus implements EventPublisher, EventSubscriber {
  private readonly handlers = new Set<(event: DomainEvent) => void>();

  async publish(event: DomainEvent): Promise<void> {
    this.emit(event);
  }

  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) this.emit(event);
  }

  async subscribe(handler: (event: DomainEvent) => void): Promise<() => void> {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private emit(event: DomainEvent): void {
    for (const handler of [...this.handlers]) {
      try {
        handler(event);
      } catch {
        // A failing subscriber must not break the publisher.
      }
    }
  }
}
