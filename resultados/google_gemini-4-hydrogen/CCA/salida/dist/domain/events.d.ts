export interface DomainEvent<TType extends string = string, TPayload = Record<string, unknown>> {
    readonly eventId: string;
    readonly type: TType;
    readonly aggregateId: string;
    readonly occurredAt: string;
    readonly version: number;
    readonly payload: TPayload;
}
export type CartEvent = DomainEvent<'CartCreated', {
    ownerId: string | null;
    currency: string;
}> | DomainEvent<'CartItemAdded', {
    lineKey: string;
    productId: string;
    quantity: number;
    unitPriceMinor: number;
}> | DomainEvent<'CartItemQuantityUpdated', {
    lineKey: string;
    productId: string;
    previousQuantity: number;
    newQuantity: number;
}> | DomainEvent<'CartItemRemoved', {
    lineKey: string;
    productId: string;
}> | DomainEvent<'CartCleared', {
    removedCount: number;
}> | DomainEvent<'CartCouponApplied', {
    code: string;
}> | DomainEvent<'CartCouponRemoved', {
    code: string;
}> | DomainEvent<'CartMerged', {
    sourceCartId: string;
    mergedItemsCount: number;
}> | DomainEvent<'CartCheckedOut', {
    ownerId: string | null;
    itemCount: number;
}>;
export declare function createDomainEvent<TType extends CartEvent['type']>(type: TType, aggregateId: string, version: number, payload: Extract<CartEvent, {
    type: TType;
}>['payload'], now?: Date): Extract<CartEvent, {
    type: TType;
}>;
//# sourceMappingURL=events.d.ts.map