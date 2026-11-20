export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'CURRENCY_MISMATCH'
  | 'CART_NOT_FOUND'
  | 'CART_NOT_ACTIVE'
  | 'CART_EXPIRED'
  | 'ITEM_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'COUPON_INVALID'
  | 'CONCURRENCY_CONFLICT'
  | 'EMPTY_CART_CHECKOUT'
  | 'IDEMPOTENCY_CONFLICT';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: DomainErrorCode,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(
    code: 'CART_NOT_FOUND' | 'ITEM_NOT_FOUND' | 'PRODUCT_NOT_FOUND',
    message: string,
  ) {
    super(code, message, 404);
  }
}

export class ConcurrencyConflictError extends DomainError {
  constructor(cartId: string, expectedVersion: number, actualVersion?: number) {
    super(
      'CONCURRENCY_CONFLICT',
      `Conflicto de concurrencia en el carrito ${cartId}: se esperaba la versión ${expectedVersion}.`,
      409,
      { cartId, expectedVersion, actualVersion },
    );
  }
}

export class InsufficientStockError extends DomainError {
  constructor(sku: string, requested: number, available: number) {
    super(
      'INSUFFICIENT_STOCK',
      `Stock insuficiente para el producto ${sku} (solicitado: ${requested}, disponible: ${available}).`,
      409,
      { sku, requested, available },
    );
  }
}
