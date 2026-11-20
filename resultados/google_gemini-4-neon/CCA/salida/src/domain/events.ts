import type { MoneyJSON } from "./money.ts";

export interface DomainEventBase<TType extends string, TPayload> {
  readonly eventId: string;
  readonly type: TType;
  readonly cartId: string;
  readonly cartVersion: number;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export type CartCreatedEvent = DomainEventBase<
  "CartCreated",
  {
    ownerId: string | null;
    currency: string;
  }
>;

export type CartItemAddedEvent = DomainEventBase<
  "CartItemAdded",
  {
    sku: string;
    quantityAdded: number;
    resultingQuantity: number;
    unitPrice: MoneyJSON;
  }
>;

export type CartItemQuantityUpdatedEvent = DomainEventBase<
  "CartItemQuantityUpdated",
  {
    sku: string;
    previousQuantity: number;
    newQuantity: number;
  }
>;

export type CartItemRemovedEvent = DomainEventBase<
  "CartItemRemoved",
  {
    sku: string;
    removedQuantity: number;
  }
>;

export type CartClearedEvent = DomainEventBase<
  "CartCleared",
  {
    clearedItemCount: number;
  }
>;

export type CartCouponAppliedEvent = DomainEventBase<
  "CartCouponApplied",
  {
    code: string;
  }
>;

export type CartCouponRemovedEvent = DomainEventBase<
  "CartCouponRemoved",
  {
    code: string;
  }
>;

export type CartMergedEvent = DomainEventBase<
  "CartMerged",
  {
    sourceCartId: string;
    mergedSkus: string[];
  }
>;

export type CartCheckedOutEvent = DomainEventBase<
  "CartCheckedOut",
  {
    orderId: string;
    ownerId: string | null;
    reservationId: string;
    grandTotal: MoneyJSON;
    itemCount: number;
  }
>;

export type CartExpiredEvent = DomainEventBase<
  "CartExpired",
  {
    expiredAt: string;
  }
>;

export type CartDomainEvent =
  | CartCreatedEvent
  | CartItemAddedEvent
  | CartItemQuantityUpdatedEvent
  | CartItemRemovedEvent
  | CartClearedEvent
  | CartCouponAppliedEvent
  | CartCouponRemovedEvent
  | CartMergedEvent
  | CartCheckedOutEvent
  | CartExpiredEvent;
