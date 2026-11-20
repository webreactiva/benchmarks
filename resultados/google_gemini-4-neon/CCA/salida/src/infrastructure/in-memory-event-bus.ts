import type { CartDomainEvent } from "../domain/events.ts";
import type { EventBus, EventHandler } from "../ports/event-bus.ts";

/**
 * In-memory asynchronous EventBus with subscriber error isolation.
 * In production, swap this adapter with Kafka, RabbitMQ, AWS EventBridge, or Redis Streams.
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlersByType = new Map<string, Set<EventHandler>>();
  private readonly wildcardHandlers = new Set<EventHandler>();
  private readonly onHandlerError?: (error: unknown, event: CartDomainEvent) => void;

  constructor(options: { onHandlerError?: (error: unknown, event: CartDomainEvent) => void } = {}) {
    this.onHandlerError = options.onHandlerError;
  }

  async publish(events: readonly CartDomainEvent[]): Promise<void> {
    for (const event of events) {
      const specific = this.handlersByType.get(event.type);
      const targets: EventHandler[] = [
        ...(specific ? Array.from(specific) : []),
        ...Array.from(this.wildcardHandlers),
      ];

      await Promise.all(
        targets.map(async (handler) => {
          try {
            await handler(event);
          } catch (error) {
            if (this.onHandlerError) {
              this.onHandlerError(error, event);
            }
          }
        }),
      );
    }
  }

  subscribe<TType extends CartDomainEvent["type"]>(
    eventType: TType,
    handler: EventHandler<Extract<CartDomainEvent, { type: TType }>>,
  ): () => void {
    let set = this.handlersByType.get(eventType);
    if (!set) {
      set = new Set();
      this.handlersByType.set(eventType, set);
    }
    const wrapped = handler as EventHandler;
    set.add(wrapped);
    return () => {
      set.delete(wrapped);
    };
  }

  subscribeAll(handler: EventHandler<CartDomainEvent>): () => void {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }
}
