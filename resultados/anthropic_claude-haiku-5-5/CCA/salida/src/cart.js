import { CartError, ErrorCodes } from './errors.js';
import { assertCents, assertCurrency } from './money.js';

/**
 * Dominio puro del carrito. Todas las funciones son inmutables: reciben un
 * carrito y devuelven uno nuevo. No tocan red, base de datos ni reloj, así que
 * son triviales de testear y de reutilizar en cualquier capa.
 *
 * Forma de un carrito:
 *   { id, currency, lines: [{ sku, name, unitPriceCents, quantity }], version }
 */

export const DEFAULT_LIMITS = Object.freeze({
  /** Máximo de líneas (SKUs distintos) por carrito: acota tamaño de documento. */
  maxLines: 100,
  /** Máximo de unidades de un mismo SKU. */
  maxQuantityPerLine: 99,
});

const CART_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** @param {object} params @returns {Readonly<object>} */
export function createCart({ id, currency }) {
  if (typeof id !== 'string' || !CART_ID_PATTERN.test(id)) {
    throw new CartError(ErrorCodes.INVALID_CART_ID, 'cart id must be 1-128 chars [A-Za-z0-9_-]');
  }
  return freeze({ id, currency: assertCurrency(currency), lines: [], version: 0 });
}

/** @param {unknown} quantity @param {typeof DEFAULT_LIMITS} limits */
function assertQuantity(quantity, limits) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new CartError(ErrorCodes.INVALID_QUANTITY, 'quantity must be a positive integer');
  }
  if (quantity > limits.maxQuantityPerLine) {
    throw new CartError(
      ErrorCodes.QUANTITY_LIMIT_EXCEEDED,
      `quantity cannot exceed ${limits.maxQuantityPerLine} per item`,
    );
  }
}

/** @param {{sku?: unknown, name?: unknown, unitPriceCents?: unknown, currency?: unknown}} product */
function assertProduct(product) {
  if (!product || typeof product.sku !== 'string' || product.sku.length === 0) {
    throw new CartError(ErrorCodes.INVALID_PRODUCT, 'product.sku is required');
  }
  if (typeof product.name !== 'string' || product.name.length === 0) {
    throw new CartError(ErrorCodes.INVALID_PRODUCT, 'product.name is required');
  }
  assertCents(product.unitPriceCents, 'product.unitPriceCents');
}

/**
 * Añade un producto (o incrementa su cantidad si ya está). El precio y el nombre
 * de la línea se refrescan con los del producto recibido.
 * @param {ReturnType<typeof createCart>} cart
 * @param {{sku: string, name: string, unitPriceCents: number, currency: string}} product
 * @param {number} [quantity=1]
 * @param {typeof DEFAULT_LIMITS} [limits=DEFAULT_LIMITS]
 */
export function addItem(cart, product, quantity = 1, limits = DEFAULT_LIMITS) {
  assertProduct(product);
  assertQuantity(quantity, limits);
  if (product.currency !== cart.currency) {
    throw new CartError(
      ErrorCodes.CURRENCY_MISMATCH,
      `product currency ${product.currency} does not match cart currency ${cart.currency}`,
    );
  }

  const index = cart.lines.findIndex((line) => line.sku === product.sku);
  const line = {
    sku: product.sku,
    name: product.name,
    unitPriceCents: product.unitPriceCents,
    quantity: 0,
  };

  if (index === -1) {
    if (cart.lines.length >= limits.maxLines) {
      throw new CartError(ErrorCodes.CART_FULL, `cart cannot hold more than ${limits.maxLines} lines`);
    }
    line.quantity = quantity;
    return withLines(cart, [...cart.lines, line]);
  }

  line.quantity = cart.lines[index].quantity + quantity;
  assertQuantity(line.quantity, limits);
  const lines = cart.lines.slice();
  lines[index] = line;
  return withLines(cart, lines);
}

/**
 * Fija la cantidad exacta de un SKU. Cantidad 0 equivale a eliminarlo.
 * @param {ReturnType<typeof createCart>} cart
 * @param {string} sku
 * @param {number} quantity
 * @param {typeof DEFAULT_LIMITS} [limits=DEFAULT_LIMITS]
 */
export function setQuantity(cart, sku, quantity, limits = DEFAULT_LIMITS) {
  if (quantity === 0) return removeItem(cart, sku);
  assertQuantity(quantity, limits);
  const index = cart.lines.findIndex((line) => line.sku === sku);
  if (index === -1) {
    throw new CartError(ErrorCodes.ITEM_NOT_FOUND, `sku ${sku} is not in the cart`);
  }
  const lines = cart.lines.slice();
  lines[index] = { ...lines[index], quantity };
  return withLines(cart, lines);
}

/**
 * Elimina un SKU. Es idempotente: si no existe, devuelve el mismo carrito.
 * @param {ReturnType<typeof createCart>} cart
 * @param {string} sku
 */
export function removeItem(cart, sku) {
  if (!cart.lines.some((line) => line.sku === sku)) return cart;
  return withLines(cart, cart.lines.filter((line) => line.sku !== sku));
}

/** @param {ReturnType<typeof createCart>} cart */
export function clear(cart) {
  return withLines(cart, []);
}

/**
 * Subtotal sin descuentos ni impuestos, en céntimos.
 * @param {{lines: Array<{unitPriceCents: number, quantity: number}>}} cart
 */
export function subtotalCents(cart) {
  let total = 0;
  for (const line of cart.lines) {
    total += line.unitPriceCents * line.quantity;
    if (!Number.isSafeInteger(total)) {
      throw new CartError(ErrorCodes.INVALID_AMOUNT, 'cart total exceeds safe integer range');
    }
  }
  return total;
}

/** @param {{lines: Array<{quantity: number}>}} cart */
export function itemCount(cart) {
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

function withLines(cart, lines) {
  return freeze({ ...cart, lines: freezeArray(lines) });
}

function freeze(obj) {
  return Object.freeze(obj);
}

function freezeArray(arr) {
  return Object.freeze(arr.map((item) => Object.freeze({ ...item })));
}
