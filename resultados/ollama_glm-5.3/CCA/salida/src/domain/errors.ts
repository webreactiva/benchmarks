/**
 * Errores de dominio.
 *
 * Cada error sabe su `code` (estable, para clientes de la API) y su estado
 * HTTP. La traducción error → respuesta HTTP vive en UN único sitio (el
 * middleware de error), así que añadir casos nuevos no obliga a tocar la capa
 * HTTP ni a buscar `res.status(...)` por todas partes.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class CartNotFoundError extends DomainError {
  constructor(cartId: string) {
    super(`No existe el carrito '${cartId}'`, 'CART_NOT_FOUND', 404, { cartId });
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(productId: string) {
    super(`No existe el producto '${productId}'`, 'PRODUCT_NOT_FOUND', 404, { productId });
  }
}

export class CartItemNotFoundError extends DomainError {
  constructor(productId: string) {
    super(`El producto '${productId}' no está en el carrito`, 'CART_ITEM_NOT_FOUND', 404, {
      productId,
    });
  }
}

export class InvalidQuantityError extends DomainError {
  constructor(quantity: unknown, max: number) {
    super(`La cantidad debe ser un entero entre 1 y ${max}`, 'INVALID_QUANTITY', 400, {
      quantity,
      max,
    });
  }
}

export class OutOfStockError extends DomainError {
  constructor(productId: string, requested: number, available: number) {
    super(
      `Stock insuficiente del producto '${productId}': solicitadas ${requested}, disponibles ${available}`,
      'OUT_OF_STOCK',
      409,
      { productId, requested, available },
    );
  }
}

export class InvalidDiscountCodeError extends DomainError {
  constructor(code: string) {
    super(`El código '${code}' no es válido`, 'INVALID_DISCOUNT_CODE', 422, { code });
  }
}

export class DiscountMinSubtotalError extends DomainError {
  constructor(code: string, requiredCents: number, currentCents: number) {
    super(
      `El código '${code}' requiere una compra mínima de ${(requiredCents / 100)
        .toFixed(2)
        .replace('.', ',')} €`,
      'DISCOUNT_MIN_SUBTOTAL',
      422,
      { code, requiredCents, currentCents },
    );
  }
}

export class EmptyCartError extends DomainError {
  constructor() {
    super('El carrito está vacío', 'EMPTY_CART', 409);
  }
}

/** Validación de forma de la petición en la capa HTTP (tipos, campos…). */
export class RequestValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'INVALID_REQUEST', 400, details);
  }
}
