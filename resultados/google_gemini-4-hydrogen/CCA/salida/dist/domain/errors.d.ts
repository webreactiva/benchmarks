export declare class DomainError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown>;
    constructor(code: string, message: string, details?: Record<string, unknown>);
}
export declare class CartNotFoundError extends DomainError {
    constructor(cartId: string);
}
export declare class CartInactiveError extends DomainError {
    constructor(cartId: string, status: string);
}
export declare class ConcurrencyConflictError extends DomainError {
    constructor(cartId: string, expectedVersion: number, actualVersion: number);
}
export declare class InvalidCurrencyError extends DomainError {
    constructor(expected: string, actual: string);
}
export declare class InvalidQuantityError extends DomainError {
    constructor(quantity: number, reason?: string);
}
export declare class InsufficientStockError extends DomainError {
    constructor(productId: string, requested: number, available: number);
}
export declare class CatalogItemNotFoundError extends DomainError {
    constructor(productId: string);
}
export declare class PromotionError extends DomainError {
    constructor(code: string, message: string, details?: Record<string, unknown>);
}
//# sourceMappingURL=errors.d.ts.map