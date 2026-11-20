export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "CART_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "CURRENCY_MISMATCH"
  | "CONCURRENCY_CONFLICT"
  | "INSUFFICIENT_STOCK"
  | "CART_LIMIT_EXCEEDED"
  | "INVALID_CART_STATE"
  | "INVALID_COUPON"
  | "LOCK_TIMEOUT"
  | "IDEMPOTENCY_CONFLICT";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, details);
  }
}

export class CartNotFoundError extends DomainError {
  constructor(cartId: string) {
    super("CART_NOT_FOUND", `Cart "${cartId}" was not found`, { cartId });
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(sku: string) {
    super("PRODUCT_NOT_FOUND", `Product SKU "${sku}" was not found`, { sku });
  }
}

export class CurrencyMismatchError extends DomainError {
  constructor(expected: string, actual: string) {
    super(
      "CURRENCY_MISMATCH",
      `Currency mismatch: expected "${expected}", got "${actual}"`,
      { expected, actual },
    );
  }
}

export class ConcurrencyConflictError extends DomainError {
  constructor(cartId: string, expectedVersion: number, actualVersion: number) {
    super(
      "CONCURRENCY_CONFLICT",
      `Optimistic lock failed for cart "${cartId}": expected version ${expectedVersion}, found ${actualVersion}`,
      { cartId, expectedVersion, actualVersion },
    );
  }
}

export class InsufficientStockError extends DomainError {
  constructor(sku: string, requested: number, available: number) {
    super(
      "INSUFFICIENT_STOCK",
      `Insufficient stock for SKU "${sku}": requested ${requested}, available ${available}`,
      { sku, requested, available },
    );
  }
}

export class CartLimitExceededError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CART_LIMIT_EXCEEDED", message, details);
  }
}

export class InvalidCartStateError extends DomainError {
  constructor(cartId: string, currentState: string, action: string) {
    super(
      "INVALID_CART_STATE",
      `Cannot ${action} cart "${cartId}" while in state "${currentState}"`,
      { cartId, currentState, action },
    );
  }
}

export class InvalidCouponError extends DomainError {
  constructor(code: string, reason: string) {
    super("INVALID_COUPON", `Coupon "${code}" cannot be applied: ${reason}`, { code, reason });
  }
}

export class LockTimeoutError extends DomainError {
  constructor(key: string, timeoutMs: number) {
    super("LOCK_TIMEOUT", `Timed out acquiring lock for "${key}" after ${timeoutMs}ms`, {
      key,
      timeoutMs,
    });
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor(key: string, reason: string) {
    super("IDEMPOTENCY_CONFLICT", `Idempotency key "${key}" conflict: ${reason}`, { key, reason });
  }
}
