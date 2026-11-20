/**
 * Agregado Carrito. Todas las funciones son puras: reciben un carrito y
 * devuelven uno nuevo. Esto permite el patrón "leer → calcular → guardar con
 * compare-and-set" y reintentar sin efectos secundarios ante conflictos.
 *
 * Los importes se representan SIEMPRE como enteros en unidades mínimas
 * (céntimos) para evitar errores de coma flotante.
 */
import { BusinessConflictError, NotFoundError, ValidationError } from './errors.ts';

export type CartStatus = 'active' | 'checked_out' | 'merged';

export interface CartLine {
  readonly sku: string;
  readonly name: string;
  /** Precio unitario en céntimos, capturado del catálogo. */
  readonly unitPrice: number;
  readonly quantity: number;
}

export interface Cart {
  readonly id: string;
  readonly ownerId: string | null;
  readonly currency: string;
  readonly lines: readonly CartLine[];
  readonly couponCodes: readonly string[];
  readonly status: CartStatus;
  /** Ids de carritos ya fusionados en éste (hace la fusión idempotente). */
  readonly mergedFrom: readonly string[];
  readonly mergedInto: string | null;
  /** Versión para control de concurrencia optimista. */
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CartLimits {
  readonly maxLines: number;
  readonly maxQuantityPerLine: number;
  readonly maxCoupons: number;
}

export interface ProductSnapshot {
  readonly sku: string;
  readonly name: string;
  readonly price: number;
  readonly currency: string;
}

export const DEFAULT_LIMITS: CartLimits = { maxLines: 100, maxQuantityPerLine: 99, maxCoupons: 3 };

const SKU_RE = /^[A-Za-z0-9._-]{1,64}$/;
const COUPON_RE = /^[A-Z0-9_-]{2,32}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

export function assertSku(sku: unknown): asserts sku is string {
  if (typeof sku !== 'string' || !SKU_RE.test(sku)) {
    throw new ValidationError('SKU inválido', { sku });
  }
}

export function assertCurrency(currency: unknown): asserts currency is string {
  if (typeof currency !== 'string' || !CURRENCY_RE.test(currency)) {
    throw new ValidationError('Moneda inválida (ISO 4217)', { currency });
  }
}

export function normalizeCoupon(code: unknown): string {
  const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!COUPON_RE.test(normalized)) throw new ValidationError('Código de cupón inválido', { code });
  return normalized;
}

export function assertQuantity(quantity: unknown, limits: CartLimits, allowZero = false): asserts quantity is number {
  const min = allowZero ? 0 : 1;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < min || quantity > limits.maxQuantityPerLine) {
    throw new ValidationError(`La cantidad debe ser un entero entre ${min} y ${limits.maxQuantityPerLine}`, { quantity });
  }
}

export function assertActive(cart: Cart): void {
  if (cart.status !== 'active') {
    throw new BusinessConflictError('CART_NOT_ACTIVE', `El carrito está en estado "${cart.status}"`, {
      cartId: cart.id,
      status: cart.status,
      mergedInto: cart.mergedInto,
    });
  }
}

export function newCart(params: { id: string; ownerId: string | null; currency: string; now: string }): Cart {
  assertCurrency(params.currency);
  return {
    id: params.id,
    ownerId: params.ownerId,
    currency: params.currency,
    lines: [],
    couponCodes: [],
    status: 'active',
    mergedFrom: [],
    mergedInto: null,
    version: 0,
    createdAt: params.now,
    updatedAt: params.now,
  };
}

export function findLine(cart: Cart, sku: string): CartLine | undefined {
  return cart.lines.find((l) => l.sku === sku);
}

export function addLine(cart: Cart, product: ProductSnapshot, quantity: number, limits: CartLimits): Cart {
  assertActive(cart);
  assertQuantity(quantity, limits);
  if (product.currency !== cart.currency) {
    throw new ValidationError('La moneda del producto no coincide con la del carrito', {
      productCurrency: product.currency,
      cartCurrency: cart.currency,
    });
  }
  const existing = findLine(cart, product.sku);
  if (existing) {
    const total = existing.quantity + quantity;
    if (total > limits.maxQuantityPerLine) {
      throw new ValidationError(`Máximo ${limits.maxQuantityPerLine} unidades por producto`, { sku: product.sku, requested: total });
    }
    return withLines(cart, cart.lines.map((l) =>
      l.sku === product.sku ? { ...l, name: product.name, unitPrice: product.price, quantity: total } : l));
  }
  if (cart.lines.length >= limits.maxLines) {
    throw new ValidationError(`Máximo ${limits.maxLines} productos distintos por carrito`);
  }
  return withLines(cart, [...cart.lines, { sku: product.sku, name: product.name, unitPrice: product.price, quantity }]);
}

/** Fija la cantidad de una línea; 0 la elimina. */
export function setLineQuantity(cart: Cart, sku: string, quantity: number, limits: CartLimits): Cart {
  assertActive(cart);
  assertQuantity(quantity, limits, true);
  const existing = findLine(cart, sku);
  if (!existing) throw new NotFoundError('LINE_NOT_FOUND', `El producto ${sku} no está en el carrito`, { sku });
  if (quantity === 0) return removeLine(cart, sku);
  if (existing.quantity === quantity) return cart;
  return withLines(cart, cart.lines.map((l) => (l.sku === sku ? { ...l, quantity } : l)));
}

export function removeLine(cart: Cart, sku: string): Cart {
  assertActive(cart);
  if (!findLine(cart, sku)) return cart; // idempotente
  return withLines(cart, cart.lines.filter((l) => l.sku !== sku));
}

export function addCoupon(cart: Cart, code: string, limits: CartLimits): Cart {
  assertActive(cart);
  if (cart.couponCodes.includes(code)) return cart; // idempotente
  if (cart.couponCodes.length >= limits.maxCoupons) {
    throw new ValidationError(`Máximo ${limits.maxCoupons} cupones por carrito`);
  }
  return { ...cart, couponCodes: [...cart.couponCodes, code] };
}

export function removeCoupon(cart: Cart, code: string): Cart {
  assertActive(cart);
  if (!cart.couponCodes.includes(code)) return cart;
  return { ...cart, couponCodes: cart.couponCodes.filter((c) => c !== code) };
}

/**
 * Fusiona el carrito `source` (p. ej. de invitado) en `target` (del usuario).
 * Es tolerante: las cantidades se limitan al máximo y las líneas que no caben
 * se descartan. Es idempotente gracias a `mergedFrom`.
 */
export function mergeInto(target: Cart, source: Cart, limits: CartLimits): Cart {
  assertActive(target);
  if (target.mergedFrom.includes(source.id) || target.id === source.id) return target;
  if (source.currency !== target.currency) {
    throw new ValidationError('No se pueden fusionar carritos con distinta moneda');
  }
  const lines = target.lines.map((l) => ({ ...l }));
  for (const incoming of source.lines) {
    const idx = lines.findIndex((l) => l.sku === incoming.sku);
    if (idx >= 0) {
      const current = lines[idx]!;
      lines[idx] = { ...current, quantity: Math.min(current.quantity + incoming.quantity, limits.maxQuantityPerLine) };
    } else if (lines.length < limits.maxLines) {
      lines.push({ ...incoming, quantity: Math.min(incoming.quantity, limits.maxQuantityPerLine) });
    }
  }
  const coupons = [...target.couponCodes];
  for (const c of source.couponCodes) {
    if (!coupons.includes(c) && coupons.length < limits.maxCoupons) coupons.push(c);
  }
  return { ...target, lines, couponCodes: coupons, mergedFrom: [...target.mergedFrom, source.id] };
}

export function markMerged(cart: Cart, intoCartId: string): Cart {
  if (cart.status === 'merged' && cart.mergedInto === intoCartId) return cart;
  assertActive(cart);
  return { ...cart, status: 'merged', mergedInto: intoCartId };
}

export function markCheckedOut(cart: Cart): Cart {
  assertActive(cart);
  if (cart.lines.length === 0) throw new BusinessConflictError('EMPTY_CART', 'El carrito está vacío');
  return { ...cart, status: 'checked_out' };
}

export function assignOwner(cart: Cart, ownerId: string): Cart {
  assertActive(cart);
  if (cart.ownerId === ownerId) return cart;
  if (cart.ownerId !== null) {
    throw new BusinessConflictError('CART_OWNED', 'El carrito pertenece a otro usuario');
  }
  return { ...cart, ownerId };
}

/** Actualiza precios/nombres a partir del catálogo actual. */
export function repriceLines(cart: Cart, products: ReadonlyMap<string, ProductSnapshot>): Cart {
  let changed = false;
  const lines = cart.lines.map((l) => {
    const p = products.get(l.sku);
    if (!p || (p.price === l.unitPrice && p.name === l.name)) return l;
    changed = true;
    return { ...l, unitPrice: p.price, name: p.name };
  });
  return changed ? withLines(cart, lines) : cart;
}

function withLines(cart: Cart, lines: CartLine[]): Cart {
  return { ...cart, lines };
}
