/**
 * Error de dominio del carrito. El `code` es estable y pensado para que
 * la capa HTTP (u otra) lo traduzca a una respuesta concreta.
 */
export class CartError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'CartError';
    this.code = code;
  }
}

export const ErrorCodes = Object.freeze({
  INVALID_CART_ID: 'INVALID_CART_ID',
  INVALID_CURRENCY: 'INVALID_CURRENCY',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  INVALID_PRODUCT: 'INVALID_PRODUCT',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  CART_NOT_FOUND: 'CART_NOT_FOUND',
  CART_ALREADY_EXISTS: 'CART_ALREADY_EXISTS',
  CART_FULL: 'CART_FULL',
  QUANTITY_LIMIT_EXCEEDED: 'QUANTITY_LIMIT_EXCEEDED',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  CONCURRENCY_CONFLICT: 'CONCURRENCY_CONFLICT',
  INVALID_RULE: 'INVALID_RULE',
});
