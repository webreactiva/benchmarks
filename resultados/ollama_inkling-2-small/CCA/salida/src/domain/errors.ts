export type DomainErrorCode =
  | "CART_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "COUPON_INVALID"
  | "CART_EMPTY"
  | "VERSION_CONFLICT";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export class CartNotFoundError extends DomainError {
  constructor(cartId: string) {
    super("CART_NOT_FOUND", `Cart not found: ${cartId}`);
    this.name = "CartNotFoundError";
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(productId: string) {
    super("PRODUCT_NOT_FOUND", `Product not found: ${productId}`);
    this.name = "ProductNotFoundError";
  }
}

export class InsufficientStockError extends DomainError {
  constructor(productId: string, requested: number, available: number) {
    super(
      "INSUFFICIENT_STOCK",
      `Insufficient stock for ${productId}: requested ${requested}, available ${available}`,
    );
    this.name = "InsufficientStockError";
  }
}

export class CouponInvalidError extends DomainError {
  constructor(code: string, reason: string) {
    super("COUPON_INVALID", `Coupon "${code}" is not valid: ${reason}`);
    this.name = "CouponInvalidError";
  }
}

export class CartEmptyError extends DomainError {
  constructor(cartId: string) {
    super("CART_EMPTY", `Cart is empty: ${cartId}`);
    this.name = "CartEmptyError";
  }
}

export class VersionConflictError extends DomainError {
  readonly currentVersion: number;

  constructor(cartId: string, expectedVersion: number, currentVersion: number) {
    super(
      "VERSION_CONFLICT",
      `Cart ${cartId} was modified concurrently (expected version ${expectedVersion}, current ${currentVersion})`,
    );
    this.name = "VersionConflictError";
    this.currentVersion = currentVersion;
  }
}
