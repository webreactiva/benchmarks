// Motor de precios basado en reglas enchufables (patrón Strategy).
//
// Cada regla es un objeto { id, type, ...params } y se evalúa con un
// "evaluador" registrado para su tipo. Añadir un nuevo tipo de promoción no
// requiere tocar el carrito ni el servicio: solo registrar un evaluador.
//
// Orden de cálculo:
//   1. subtotal = Σ unitPrice × quantity
//   2. descuentos de línea (p. ej. 3x2)
//   3. descuentos de pedido (p. ej. -10 % a partir de 50 €)
//   4. envío (con reglas de envío gratis)
//   5. impuestos sobre (subtotal - descuentos + envío)   [precios sin IVA]

import { percentOf } from './money.js';

const evaluators = new Map();

/** Registra un tipo de regla. `fn(rule, ctx) => [{ ruleId, label, amount }]` (amount en céntimos, positivo). */
export function registerRuleType(type, fn) {
  evaluators.set(type, fn);
}

// ---- Tipos de regla incluidos ------------------------------------------------

// Porcentaje sobre el pedido, opcionalmente con mínimo de compra.
registerRuleType('percent_off_order', (rule, ctx) => {
  if (ctx.subtotalAfterLineDiscounts < (rule.minSubtotal ?? 0)) return [];
  const amount = percentOf(ctx.subtotalAfterLineDiscounts, rule.percent);
  return amount > 0 ? [{ ruleId: rule.id, label: rule.label ?? `-${rule.percent}%`, amount }] : [];
});

// Importe fijo sobre el pedido, opcionalmente con mínimo de compra.
registerRuleType('fixed_off_order', (rule, ctx) => {
  if (ctx.subtotalAfterLineDiscounts < (rule.minSubtotal ?? 0)) return [];
  const amount = Math.min(rule.amount, ctx.subtotalAfterLineDiscounts);
  return amount > 0 ? [{ ruleId: rule.id, label: rule.label ?? 'Descuento', amount }] : [];
});

// Porcentaje sobre productos concretos.
registerRuleType('percent_off_skus', (rule, ctx) => {
  const skus = new Set(rule.skus);
  return ctx.lines
    .filter((l) => skus.has(l.sku))
    .map((l) => ({ ruleId: rule.id, label: rule.label ?? `-${rule.percent}% ${l.sku}`, sku: l.sku, amount: percentOf(l.lineTotal, rule.percent) }))
    .filter((d) => d.amount > 0);
});

// Lleva X, paga Y (3x2) sobre productos concretos.
registerRuleType('buy_x_pay_y', (rule, ctx) => {
  const skus = new Set(rule.skus);
  return ctx.lines
    .filter((l) => skus.has(l.sku))
    .map((l) => {
      const free = Math.floor(l.quantity / rule.buy) * (rule.buy - rule.pay);
      return { ruleId: rule.id, label: rule.label ?? `${rule.buy}x${rule.pay} ${l.sku}`, sku: l.sku, amount: free * l.unitPrice };
    })
    .filter((d) => d.amount > 0);
});

const LINE_RULES = new Set(['percent_off_skus', 'buy_x_pay_y']);

// ---- Cálculo -----------------------------------------------------------------

/**
 * @param cart     carrito del dominio
 * @param options  { rules: [], taxRate: 21, shipping: { flat, freeOver } }
 */
export function priceCart(cart, { rules = [], taxRate = 0, shipping = { flat: 0, freeOver: null } } = {}) {
  const lines = cart.items.map((i) => ({
    sku: i.sku,
    name: i.name,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    lineTotal: i.unitPrice * i.quantity,
  }));
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  const known = rules.filter((r) => evaluators.has(r.type));
  const lineRules = known.filter((r) => LINE_RULES.has(r.type));
  const orderRules = known.filter((r) => !LINE_RULES.has(r.type));

  const ctx = { lines, subtotal, subtotalAfterLineDiscounts: subtotal };
  const discounts = [];

  for (const rule of lineRules) discounts.push(...evaluators.get(rule.type)(rule, ctx));
  // Un descuento de línea nunca puede superar el importe de la línea.
  capLineDiscounts(discounts, lines);
  ctx.subtotalAfterLineDiscounts = subtotal - sum(discounts);

  for (const rule of orderRules) {
    const produced = evaluators.get(rule.type)(rule, ctx);
    discounts.push(...produced);
    ctx.subtotalAfterLineDiscounts -= sum(produced);
  }

  const discountTotal = Math.min(sum(discounts), subtotal);
  const net = subtotal - discountTotal;

  const freeShipping = shipping.freeOver != null && net >= shipping.freeOver;
  const shippingCost = lines.length === 0 || freeShipping ? 0 : (shipping.flat ?? 0);

  const taxable = net + shippingCost;
  const tax = percentOf(taxable, taxRate);

  return {
    currency: cart.currency,
    lines,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal,
    discounts,
    discountTotal,
    shipping: shippingCost,
    taxRate,
    tax,
    total: taxable + tax,
  };
}

function sum(list) {
  return list.reduce((s, d) => s + d.amount, 0);
}

function capLineDiscounts(discounts, lines) {
  const remaining = new Map(lines.map((l) => [l.sku, l.lineTotal]));
  for (const d of discounts) {
    const left = remaining.get(d.sku) ?? 0;
    d.amount = Math.min(d.amount, left);
    remaining.set(d.sku, left - d.amount);
  }
  for (let i = discounts.length - 1; i >= 0; i--) if (discounts[i].amount === 0) discounts.splice(i, 1);
}
