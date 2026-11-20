/**
 * Errores de dominio. Cada uno lleva un código estable (`code`) que se expone
 * en la respuesta HTTP para que los clientes puedan reaccionar sin parsear
 * mensajes, y un estado HTTP asociado.
 */
export type ErrorCode =
  | 'CART_NOT_FOUND'
  | 'CART_VERSION_CONFLICT'
  | 'CART_ALREADY_CHECKED_OUT'
  | 'CART_LINE_NOT_FOUND'
  | 'INVALID_QUANTITY'
  | 'CART_LIMIT_EXCEEDED'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'OUT_OF_STOCK'
  | 'PROMO_NOT_FOUND'
  | 'PROMO_NOT_APPLICABLE'
  | 'INVALID_PAYLOAD'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'INTERNAL_ERROR';

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }

  toJSON(): Record<string, unknown> {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export class CartNotFoundError extends DomainError {
  constructor(cartId: string) {
    super('CART_NOT_FOUND', `El carrito ${cartId} no existe`, 404, { cartId });
  }
}

export class CartVersionConflictError extends DomainError {
  constructor(cartId: string, expectedVersion: number, actualVersion: number) {
    super(
      'CART_VERSION_CONFLICT',
      'El carrito ha cambiado desde la última lectura; vuelve a intentarlo con la versión actual',
      409,
      { cartId, expectedVersion, actualVersion },
    );
  }
}

export class InvalidQuantityError extends DomainError {
  constructor(quantity: number, max: number) {
    super('INVALID_QUANTITY', `Cantidad inválida: ${quantity} (máximo ${max})`, 400, {
      quantity,
      max,
    });
  }
}

export class CartLimitExceededError extends DomainError {
  constructor(maxItems: number) {
    super('CART_LIMIT_EXCEEDED', `El carrito no puede superar ${maxItems} líneas`, 409, {
      maxItems,
    });
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(productId: string) {
    super('PRODUCT_NOT_FOUND', `El producto ${productId} no existe en el catálogo`, 404, {
      productId,
    });
  }
}

export class ProductInactiveError extends DomainError {
  constructor(productId: string) {
    super('PRODUCT_INACTIVE', `El producto ${productId} no está disponible`, 409, {
      productId,
    });
  }
}

export class OutOfStockError extends DomainError {
  constructor(sku: string, requested: number, available: number) {
    super('OUT_OF_STOCK', `Stock insuficiente para ${sku}`, 409, { sku, requested, available });
  }
}

export class PromoNotFoundError extends DomainError {
  constructor(code: string) {
    super('PROMO_NOT_FOUND', `El código promocional ${code} no existe`, 404, { code });
  }
}

export class PromoNotApplicableError extends DomainError {
  constructor(code: string, reason: string) {
    super('PROMO_NOT_APPLICABLE', `El código ${code} no es aplicable: ${reason}`, 422, {
      code,
      reason,
    });
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Credenciales ausentes o inválidas') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'No tienes permisos sobre este recurso') {
    super('FORBIDDEN', message, 403);
  }
}

export class RateLimitedError extends DomainError {
  constructor(retryAfterSeconds: number) {
    super('RATE_LIMITED', 'Demasiadas peticiones, inténtalo más tarde', 429, {
      retryAfterSeconds,
    });
  }
}

export class InvalidPayloadError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_PAYLOAD', message, 400, details);
  }
}
