export interface DomainEvent<TType extends string = string, TPayload = Record<string, unknown>> {
  readonly eventId: string;
  readonly type: TType;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly version: number;
  readonly payload: TPayload;
}

export type CartEvent =
  | DomainEvent<'CartCreated', { ownerId: string | null; currency: string }>
  | DomainEvent<
      'CartItemAdded',
      { lineKey: string; productId: string; quantity: number; unitPriceMinor: number }
    >
  | DomainEvent<
      'CartItemQuantityUpdated',
      { lineKey: string; productId: string; previousQuantity: number; newQuantity: number }
    >
  | DomainEvent<'CartItemRemoved', { lineKey: string; productId: string }>
  | DomainEvent<'CartCleared', { removedCount: number }>
  | DomainEvent<'CartCouponApplied', { code: string }>
  | DomainEvent<'CartCouponRemoved', { code: string }>
  | DomainEvent<'CartMerged', { sourceCartId: string; mergedItemsCount: number }>
  | DomainEvent<'CartCheckedOut', { ownerId: string | null; itemCount: number }>;

let eventCounter = 0;

export function createDomainEvent<TType extends CartEvent['type']>(
  type: TType,
  aggregateId: string,
  version: number,
  payload: Extract<CartEvent, { type: TType }>['payload'],
  now: Date = new Date(),
): Extract<CartEvent, { type: TType }> {
  eventCounter += 1;
  const randomPart = Math.random().toString(36).slice(2, 10);
  return {
    eventId: `evt_${now.getTime()}_${eventCounter}_${randomPart}`,
    type,
    aggregateId,
    occurredAt: now.toISOString(),
    version,
    payload,
  } as Extract<CartEvent, { type: TType }>;
}
