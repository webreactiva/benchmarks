export type CartEventType =
  | 'cart.created'
  | 'cart.item_added'
  | 'cart.item_updated'
  | 'cart.item_removed'
  | 'cart.cleared'
  | 'cart.coupon_applied'
  | 'cart.coupon_removed'
  | 'cart.merged'
  | 'cart.checked_out';

/**
 * Domain events are published through the outbox so that side effects
 * (analytics, search, emails, stock) never block or break the cart write path.
 */
export interface DomainEvent {
  readonly id: string;
  readonly type: CartEventType;
  readonly cartId: string;
  readonly customerId: string | null;
  readonly occurredAt: string;
  readonly version: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface EventEnvelope {
  readonly channel: string;
  readonly event: DomainEvent;
}
