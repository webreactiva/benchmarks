/**
 * Domain errors are the single source of truth for "why did this fail".
 * The HTTP layer maps them to status codes, so the domain never depends on
 * transport concerns.
 */
export type DomainErrorCode =
  | 'CART_NOT_FOUND'
  | 'CART_CONFLICT'
  | 'CART_IMMUTABLE'
  | 'CART_LIMIT_EXCEEDED'
  | 'INVALID_QUANTITY'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_UNAVAILABLE'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'COUPON_MIN_SUBTOTAL'
  | 'INSUFFICIENT_STOCK'
  | 'FORBIDDEN'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CHECKOUT_FAILED';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: DomainErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }

  toJSON(): { code: DomainErrorCode; message: string; details: Record<string, unknown> } {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export class CartNotFoundError extends DomainError {
  constructor(cartId: string) {
    super('CART_NOT_FOUND', `Cart "${cartId}" was not found`, { cartId });
  }
}

export class CartConflictError extends DomainError {
  constructor(cartId: string, expectedVersion: number, actualVersion: number) {
    super(
      'CART_CONFLICT',
      `Cart "${cartId}" was modified concurrently (expected version ${expectedVersion}, current ${actualVersion})`,
      { cartId, expectedVersion, actualVersion },
    );
  }
}

export class CartImmutableError extends DomainError {
  constructor(cartId: string) {
    super('CART_IMMUTABLE', `Cart "${cartId}" is not modifiable anymore`, { cartId });
  }
}

export class CurrencyMismatchError extends DomainError {
  constructor(expected: string, received: string) {
    super(
      'CART_LIMIT_EXCEEDED',
      `Currency mismatch: cart is in ${expected} but the operation used ${received}`,
      { expected, received },
    );
  }
}

export class CartLimitExceededError extends DomainError {
  constructor(limit: string, max: number, actual: number) {
    super('CART_LIMIT_EXCEEDED', `Cart limit "${limit}" exceeded (max ${max}, got ${actual})`, {
      limit,
      max,
      actual,
    });
  }
}

export class InvalidQuantityError extends DomainError {
  constructor(quantity: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
    super('INVALID_QUANTITY', `Quantity must be between ${min} and ${max}, received: ${quantity}`, {
      quantity,
      min,
      max,
    });
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(productId: string) {
    super('PRODUCT_NOT_FOUND', `Product "${productId}" was not found`, { productId });
  }
}

export class ProductUnavailableError extends DomainError {
  constructor(productId: string, reason: string) {
    super('PRODUCT_UNAVAILABLE', `Product "${productId}" is not available: ${reason}`, {
      productId,
    });
  }
}

export class CouponError extends DomainError {
  constructor(code: DomainErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(code, message, details);
  }
}

export class InsufficientStockError extends DomainError {
  constructor(productId: string, requested: number, available: number) {
    super(
      'INSUFFICIENT_STOCK',
      `Not enough stock for product "${productId}" (requested ${requested}, available ${available})`,
      { productId, requested, available },
    );
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('FORBIDDEN', message, details);
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor(key: string) {
    super(
      'IDEMPOTENCY_CONFLICT',
      `Idempotency key "${key}" was already used with a different request payload`,
      { key },
    );
  }
}

export class CheckoutFailedError extends DomainError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('CHECKOUT_FAILED', message, details);
  }
}
