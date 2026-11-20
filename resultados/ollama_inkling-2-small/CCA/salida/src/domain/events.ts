export type DomainEventType =
  | "cart.created"
  | "cart.item_added"
  | "cart.item_quantity_updated"
  | "cart.item_removed"
  | "cart.cleared"
  | "coupon.applied"
  | "coupon.removed"
  | "cart.checked_out";

export interface DomainEvent {
  type: DomainEventType;
  cartId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export function domainEvent(
  type: DomainEventType,
  cartId: string,
  payload: Record<string, unknown> = {},
): DomainEvent {
  return { type, cartId, occurredAt: new Date().toISOString(), payload };
}
