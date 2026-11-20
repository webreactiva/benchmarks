import { CartError, ErrorCodes } from './errors.js';
import { applyBps, assertCents } from './money.js';
import { itemCount, subtotalCents } from './cart.js';

/**
 * Motor de precios. Un cálculo es: subtotal → descuentos en cadena → impuestos.
 *
 * Una regla de descuento es un objeto `{ name, amount(cart, context) }` que
 * devuelve los céntimos a descontar sobre el subtotal original. El motor limita
 * cada descuento al importe restante, así nunca se puede dejar un total negativo.
 * Añadir una promoción nueva = añadir una regla; no hay que tocar el motor.
 */

/**
 * Descuento porcentual sobre las líneas de un SKU concreto.
 * @param {{sku: string, percentBps: number, name?: string}} options  1 bp = 0.01%
 */
export function percentOffSku({ sku, percentBps, name = `${percentBps / 100}% off ${sku}` }) {
  assertBps(percentBps);
  return {
    name,
    amount(cart) {
      const base = cart.lines
        .filter((line) => line.sku === sku)
        .reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
      return applyBps(base, percentBps);
    },
  };
}

/**
 * Descuento porcentual sobre el carrito completo si se supera un mínimo.
 * @param {{minSubtotalCents: number, percentBps: number, name?: string}} options
 */
export function percentOffCart({ minSubtotalCents, percentBps, name }) {
  assertBps(percentBps);
  assertCents(minSubtotalCents, 'minSubtotalCents');
  return {
    name: name ?? `${percentBps / 100}% off orders over ${minSubtotalCents}`,
    amount(cart) {
      const subtotal = subtotalCents(cart);
      return subtotal >= minSubtotalCents ? applyBps(subtotal, percentBps) : 0;
    },
  };
}

/**
 * Descuento fijo si se supera un mínimo de subtotal.
 * @param {{minSubtotalCents: number, amountCents: number, name?: string}} options
 */
export function fixedOffCart({ minSubtotalCents, amountCents, name }) {
  assertCents(minSubtotalCents, 'minSubtotalCents');
  assertCents(amountCents, 'amountCents');
  return {
    name: name ?? `${amountCents} off orders over ${minSubtotalCents}`,
    amount(cart) {
      return subtotalCents(cart) >= minSubtotalCents ? amountCents : 0;
    },
  };
}

/**
 * Descuento "lleva N, paga M" sobre un SKU (p. ej. 3x2).
 * @param {{sku: string, buy: number, pay: number, name?: string}} options
 */
export function buyXPayY({ sku, buy, pay, name }) {
  if (!Number.isSafeInteger(buy) || !Number.isSafeInteger(pay) || pay < 0 || buy <= pay) {
    throw new CartError(ErrorCodes.INVALID_RULE, 'buyXPayY requires integers with buy > pay >= 0');
  }
  return {
    name: name ?? `buy ${buy} pay ${pay} on ${sku}`,
    amount(cart) {
      const line = cart.lines.find((l) => l.sku === sku);
      if (!line) return 0;
      const freeUnits = Math.floor(line.quantity / buy) * (buy - pay);
      return freeUnits * line.unitPriceCents;
    },
  };
}

/**
 * Calcula el desglose completo de un carrito.
 * Es puro: no persiste nada, así que puede ejecutarse en cualquier nodo.
 *
 * @param {object} cart
 * @param {{rules?: Array<{name: string, amount: Function}>, taxRateBps?: number}} [config]
 * @returns {{
 *   currency: string, itemCount: number, subtotalCents: number,
 *   discounts: Array<{name: string, amountCents: number}>, discountCents: number,
 *   taxableCents: number, taxRateBps: number, taxCents: number, totalCents: number
 * }}
 */
export function calculateTotals(cart, { rules = [], taxRateBps = 0 } = {}) {
  assertBps(taxRateBps);
  const subtotal = subtotalCents(cart);
  let remaining = subtotal;
  const discounts = [];

  for (const rule of rules) {
    if (remaining === 0) break;
    const raw = rule.amount(cart);
    const applied = Math.min(Math.max(0, Math.floor(raw)), remaining);
    if (applied > 0) {
      discounts.push({ name: rule.name, amountCents: applied });
      remaining -= applied;
    }
  }

  const discountCents = subtotal - remaining;
  const taxableCents = remaining;
  const taxCents = applyBps(taxableCents, taxRateBps);

  return {
    currency: cart.currency,
    itemCount: itemCount(cart),
    subtotalCents: subtotal,
    discounts,
    discountCents,
    taxableCents,
    taxRateBps,
    taxCents,
    totalCents: taxableCents + taxCents,
  };
}

function assertBps(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10000) {
    throw new CartError(ErrorCodes.INVALID_RULE, 'basis points must be an integer in [0, 10000]');
  }
}
