import type { CartItem, CartTotals } from './cart.js';
import type { PromoRule } from '../config.js';
import { applyBps } from './money.js';

export interface PricingInput {
  items: CartItem[];
  promoCodes: string[];
  currency: CartTotals['currency'];
  shippingFlatCents: number;
  freeShippingThresholdCents: number;
  taxBps: number;
  promos: Record<string, PromoRule>;
}

/**
 * Motor de precios determinista. Es la única fuente de verdad de los totales
 * y está replicado 1:1 en `src/infrastructure/lua/cart.lua` (mismo orden de
 * operaciones, misma aritmética entera) para que la mutación atómica dentro
 * de Redis y el recálculo en el proceso de aplicación den exactamente el
 * mismo resultado. `test/unit/pricing.parity.test.ts` verifica la paridad.
 */
export function computeTotals(input: PricingInput): CartTotals {
  const { items, promoCodes, currency, promos } = input;

  let subtotalCents = 0;
  let discountCents = 0;
  let netCents = 0;

  const lineNet: number[] = [];

  for (const item of items) {
    const gross = item.unitPriceCents * item.quantity;
    const volumeDiscount = applyBps(gross, item.discountBps);
    subtotalCents += gross;
    discountCents += volumeDiscount;
    const net = gross - volumeDiscount;
    netCents += net;
    lineNet.push(net);
  }

  // Los cupones se aplican sobre el importe ya descontado por volumen, en el
  // orden en que se añadieron al carrito.
  let promoCents = 0;
  let remaining = netCents;
  for (const code of promoCodes) {
    const rule = promos[code];
    if (!rule) continue;
    let amount = 0;
    if (rule.type === 'percent') {
      if (rule.minSubtotalCents !== undefined && remaining < rule.minSubtotalCents) continue;
      amount = applyBps(remaining, rule.bps);
      if (rule.maxDiscountCents !== undefined && amount > rule.maxDiscountCents) {
        amount = rule.maxDiscountCents;
      }
    } else {
      if (rule.minSubtotalCents !== undefined && remaining < rule.minSubtotalCents) continue;
      amount = rule.amountCents;
    }
    if (amount > remaining) amount = remaining;
    if (amount <= 0) continue;
    promoCents += amount;
    remaining -= amount;
  }

  const netAfterPromoCents = netCents - promoCents;
  const shippingCents =
    netAfterPromoCents === 0
      ? 0
      : netAfterPromoCents >= input.freeShippingThresholdCents
        ? 0
        : input.shippingFlatCents;
  const taxCents = applyBps(netAfterPromoCents + shippingCents, input.taxBps);
  const totalCents = netAfterPromoCents + shippingCents + taxCents;

  let itemCount = 0;
  for (const item of items) itemCount += item.quantity;

  return {
    currency,
    subtotalCents,
    discountCents,
    promoCents,
    shippingCents,
    taxCents,
    totalCents,
    itemCount,
  };
}

/**
 * Prorratea el descuento de cupón entre las líneas de forma determinista
 * (resto al último importe), de modo que la suma de las líneas coincide
 * exactamente con el total del carrito sin perder ni crear céntimos.
 */
export function proratePromo(items: CartItem[], totals: CartTotals): CartItem[] {
  const netBase = totals.subtotalCents - totals.discountCents;
  if (totals.promoCents === 0 || netBase <= 0) {
    return items.map((item) => ({
      ...item,
      promoCents: 0,
      lineTotalCents: item.unitPriceCents * item.quantity - item.discountCents,
    }));
  }

  const result: CartItem[] = [];
  let assigned = 0;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const gross = item.unitPriceCents * item.quantity;
    const lineNet = gross - item.discountCents;
    const isLast = i === items.length - 1;
    const share = isLast
      ? totals.promoCents - assigned
      : Math.floor((totals.promoCents * lineNet) / netBase);
    assigned += share;
    result.push({
      ...item,
      promoCents: share,
      lineTotalCents: gross - item.discountCents - share,
    });
  }
  return result;
}
