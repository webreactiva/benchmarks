import type { CartDomainEvent } from "../domain/events.ts";

export type EventHandler<TEvent extends CartDomainEvent = CartDomainEvent> = (
  event: TEvent,
) => void | Promise<void>;

/**
 * Event Bus Port for decoupling cart mutations from downstream consumers
 * (analytics, abandoned-cart emails, order management, warehouse fulfillment).
 */
export interface EventBus {
  publish(events: readonly CartDomainEvent[]): Promise<void>;
  subscribe<TType extends CartDomainEvent["type"]>(
    eventType: TType,
    handler: EventHandler<Extract<CartDomainEvent, { type: TType }>>,
  ): () => void;
  subscribeAll(handler: EventHandler<CartDomainEvent>): () => void;
}
