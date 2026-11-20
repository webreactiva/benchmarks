// Agregado Carrito.
//
// Es un objeto de datos plano (serializable a JSON tal cual) y las operaciones
// son funciones puras que devuelven un carrito NUEVO. Esto permite:
//   - guardarlo en cualquier almacén (memoria, Redis, DynamoDB...) sin mapeos;
//   - reintentar mutaciones ante conflictos de concurrencia sin efectos colaterales;
//   - testear el dominio sin infraestructura.

import { randomUUID } from 'node:crypto';
import { ValidationError, LimitExceededError, NotFoundError } from './errors.js';
import { assertCents } from './money.js';

export const DEFAULT_LIMITS = Object.freeze({
  maxLines: 100,          // productos distintos por carrito
  maxQuantityPerLine: 99, // unidades por producto
  maxCoupons: 5,
});

const SKU_RE = /^[A-Za-z0-9._-]{1,64}$/;
const COUPON_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function assertSku(sku) {
  if (typeof sku !== 'string' || !SKU_RE.test(sku)) {
    throw new ValidationError('SKU inválido', { sku });
  }
  return sku;
}

export function assertQuantity(quantity, limits = DEFAULT_LIMITS) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new ValidationError('La cantidad debe ser un entero >= 0', { quantity });
  }
  if (quantity > limits.maxQuantityPerLine) {
    throw new LimitExceededError(`Máximo ${limits.maxQuantityPerLine} unidades por producto`, {
      quantity,
      max: limits.maxQuantityPerLine,
    });
  }
  return quantity;
}

export function normalizeCoupon(code) {
  if (typeof code !== 'string' || !COUPON_RE.test(code.trim())) {
    throw new ValidationError('Código de cupón inválido', { code });
  }
  return code.trim().toUpperCase();
}

export function createCart({ id = randomUUID(), ownerId = null, currency = 'EUR', now = Date.now() } = {}) {
  return {
    id,
    ownerId,
    currency,
    items: [],      // [{ sku, name, unitPrice, quantity, addedAt }]
    coupons: [],    // ['VERANO10', ...]
    version: 0,     // control de concurrencia optimista
    createdAt: now,
    updatedAt: now,
  };
}

function touch(cart, changes, now) {
  return { ...cart, ...changes, updatedAt: now };
}

/**
 * Fija la cantidad de un SKU (0 = eliminar). El precio y nombre vienen del
 * catálogo (nunca del cliente) y se actualizan en cada modificación.
 */
export function setItem(cart, { sku, name, unitPrice, quantity }, { limits = DEFAULT_LIMITS, now = Date.now() } = {}) {
  assertSku(sku);
  assertQuantity(quantity, limits);
  assertCents(unitPrice, 'unitPrice');

  const idx = cart.items.findIndex((i) => i.sku === sku);

  if (quantity === 0) {
    if (idx === -1) return cart;
    return touch(cart, { items: cart.items.filter((_, i) => i !== idx) }, now);
  }

  if (idx === -1) {
    if (cart.items.length >= limits.maxLines) {
      throw new LimitExceededError(`Máximo ${limits.maxLines} productos distintos por carrito`, {
        max: limits.maxLines,
      });
    }
    return touch(cart, { items: [...cart.items, { sku, name, unitPrice, quantity, addedAt: now }] }, now);
  }

  const items = cart.items.slice();
  items[idx] = { ...items[idx], name, unitPrice, quantity };
  return touch(cart, { items }, now);
}

export function getQuantity(cart, sku) {
  return cart.items.find((i) => i.sku === sku)?.quantity ?? 0;
}

export function removeItem(cart, sku, { now = Date.now() } = {}) {
  assertSku(sku);
  if (!cart.items.some((i) => i.sku === sku)) {
    throw new NotFoundError(`El producto ${sku} no está en el carrito`);
  }
  return touch(cart, { items: cart.items.filter((i) => i.sku !== sku) }, now);
}

export function addCoupon(cart, code, { limits = DEFAULT_LIMITS, now = Date.now() } = {}) {
  const normalized = normalizeCoupon(code);
  if (cart.coupons.includes(normalized)) return cart;
  if (cart.coupons.length >= limits.maxCoupons) {
    throw new LimitExceededError(`Máximo ${limits.maxCoupons} cupones`, { max: limits.maxCoupons });
  }
  return touch(cart, { coupons: [...cart.coupons, normalized] }, now);
}

export function removeCoupon(cart, code, { now = Date.now() } = {}) {
  const normalized = normalizeCoupon(code);
  if (!cart.coupons.includes(normalized)) {
    throw new NotFoundError(`El cupón ${normalized} no está aplicado`);
  }
  return touch(cart, { coupons: cart.coupons.filter((c) => c !== normalized) }, now);
}

export function clearCart(cart, { now = Date.now() } = {}) {
  return touch(cart, { items: [], coupons: [] }, now);
}

/** Cantidades combinadas de dos carritos (p. ej. carrito de invitado + carrito del usuario al hacer login). */
export function mergedQuantities(target, source, limits = DEFAULT_LIMITS) {
  const result = new Map(target.items.map((i) => [i.sku, i.quantity]));
  for (const item of source.items) {
    const q = (result.get(item.sku) ?? 0) + item.quantity;
    result.set(item.sku, Math.min(q, limits.maxQuantityPerLine));
  }
  return result;
}
