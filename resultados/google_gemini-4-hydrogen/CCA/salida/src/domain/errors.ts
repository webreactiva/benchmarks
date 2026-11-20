export class DomainError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export class CartNotFoundError extends DomainError {
  constructor(cartId: string) {
    super('CART_NOT_FOUND', `El carrito "${cartId}" no existe.`, { cartId });
  }
}

export class CartInactiveError extends DomainError {
  constructor(cartId: string, status: string) {
    super(
      'CART_INACTIVE',
      `El carrito "${cartId}" no puede modificarse porque su estado es "${status}".`,
      { cartId, status },
    );
  }
}

export class ConcurrencyConflictError extends DomainError {
  constructor(cartId: string, expectedVersion: number, actualVersion: number) {
    super(
      'CONCURRENCY_CONFLICT',
      `Conflicto de concurrencia en carrito "${cartId}": se esperaba versión ${expectedVersion}, pero la actual es ${actualVersion}.`,
      { cartId, expectedVersion, actualVersion },
    );
  }
}

export class InvalidCurrencyError extends DomainError {
  constructor(expected: string, actual: string) {
    super(
      'INVALID_CURRENCY',
      `Moneda incompatible: se esperaba "${expected}", se recibió "${actual}".`,
      { expected, actual },
    );
  }
}

export class InvalidQuantityError extends DomainError {
  constructor(quantity: number, reason = 'La cantidad debe ser un entero positivo.') {
    super('INVALID_QUANTITY', `${reason} Valor recibido: ${quantity}.`, { quantity });
  }
}

export class InsufficientStockError extends DomainError {
  constructor(productId: string, requested: number, available: number) {
    super(
      'INSUFFICIENT_STOCK',
      `Stock insuficiente para el producto "${productId}": solicitado ${requested}, disponible ${available}.`,
      { productId, requested, available },
    );
  }
}

export class CatalogItemNotFoundError extends DomainError {
  constructor(productId: string) {
    super('CATALOG_ITEM_NOT_FOUND', `Producto "${productId}" no encontrado en el catálogo.`, {
      productId,
    });
  }
}

export class PromotionError extends DomainError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
  }
}
