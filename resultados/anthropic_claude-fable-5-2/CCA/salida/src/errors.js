/** Error de dominio con código estable y estado HTTP asociado. */
export class CartError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'CartError';
    this.status = status;
    this.code = code;
  }
}

export const invalid = (message) => new CartError(400, 'INVALID_REQUEST', message);
export const unknownSku = (sku) => new CartError(404, 'UNKNOWN_SKU', `El producto "${sku}" no existe`);
export const tooManyLines = (max) =>
  new CartError(409, 'CART_LINE_LIMIT', `El carrito no puede tener más de ${max} productos distintos`);
export const quantityExceeded = (max) =>
  new CartError(409, 'QUANTITY_LIMIT', `No se pueden añadir más de ${max} unidades de un mismo producto`);
