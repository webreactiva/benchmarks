import type { EventBusPort, EventSubscriber } from '../../application/ports.ts';
import type { DomainEvent } from '../../domain/events.ts';

export class InMemoryEventBus implements EventBusPort {
  private readonly subscribers = new Map<string, Set<EventSubscriber>>();
  private readonly recentEvents: DomainEvent[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 500) {
    this.maxHistory = maxHistory;
  }

  async publish(events: ReadonlyArray<DomainEvent>): Promise<void> {
    for (const event of events) {
      if (this.recentEvents.length >= this.maxHistory) {
        this.recentEvents.shift();
      }
      this.recentEvents.push(event);

      const typedHandlers = this.subscribers.get(event.type);
      const wildcardHandlers = this.subscribers.get('*');

      if (typedHandlers) {
        for (const handler of typedHandlers) {
          await handler(event);
        }
      }
      if (wildcardHandlers) {
        for (const handler of wildcardHandlers) {
          await handler(event);
        }
      }
    }
  }

  subscribe(
    eventType: DomainEvent['type'] | '*',
    subscriber: EventSubscriber,
  ): () => void {
    let set = this.subscribers.get(eventType);
    if (!set) {
      set = new Set();
      this.subscribers.set(eventType, set);
    }
    set.add(subscriber);
    return () => {
      set.delete(subscriber);
    };
  }

  getRecentEvents(limit = 50): ReadonlyArray<DomainEvent> {
    return this.recentEvents.slice(-limit);
  }
}
