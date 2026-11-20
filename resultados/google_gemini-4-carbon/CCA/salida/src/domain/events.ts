export type DomainEventType =
  | 'cart.created'
  | 'cart.item_upserted'
  | 'cart.item_removed'
  | 'cart.coupon_applied'
  | 'cart.coupon_removed'
  | 'cart.merged'
  | 'cart.checked_out'
  | 'cart.cleared';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  readonly eventId: string;
  readonly type: DomainEventType;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly occurredAt: string;
  readonly payload: TPayload;
}
