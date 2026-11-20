import test from 'node:test';
import assert from 'node:assert/strict';

import { PricingEngine } from '../src/core/pricing/PricingEngine.js';
import { createDefaultPricing } from '../src/config/pricing.js';

const pricing = createDefaultPricing();

function state(items, coupon = null) {
  return { items, coupon, currency: 'EUR' };
}

function item(priceCents, qty = 1, name = 'Producto') {
  return { productId: name, name, priceCents, qty, category: 'Test' };
}

test('calcula subtotal, envío, IVA y total sin descuentos', () => {
  const totals = pricing.calculate(state([item(1000)]));

  assert.equal(totals.subtotalCents, 1000);
  assert.equal(totals.discountCents, 0);
  assert.equal(totals.shippingCents, 499);
  assert.equal(totals.taxCents, 315);
  assert.equal(totals.totalCents, 1814);
});

test('aplica envío gratis a partir del umbral', () => {
  const totals = pricing.calculate(state([item(6000)]));

  assert.equal(totals.shippingCents, 0);
  assert.equal(totals.taxCents, 1260);
  assert.equal(totals.totalCents, 7260);
  assert.equal(totals.freeShippingReached, true);
});

test('informa cuánto falta para el envío gratis', () => {
  const totals = pricing.calculate(state([item(2000)]));

  assert.equal(totals.freeShippingRemainingCents, 3000);
  assert.equal(totals.freeShippingReached, false);
});

test('aplica descuento por volumen desde tres unidades', () => {
  const totals = pricing.calculate(state([item(1000, 3)]));

  assert.equal(totals.subtotalCents, 3000);
  assert.equal(totals.discountCents, 300);
  assert.equal(totals.discountedSubtotalCents, 2700);
  assert.equal(totals.shippingCents, 499);
  assert.equal(totals.taxCents, 672);
  assert.equal(totals.totalCents, 3871);
});

test('aplica cupón porcentual', () => {
  const totals = pricing.calculate(
    state([item(3000)], { code: 'BIENVENIDO10', type: 'percent', value: 10 }),
  );

  assert.equal(totals.discountCents, 300);
  assert.equal(totals.couponApplied, true);
  assert.equal(totals.totalCents, 3871);
});

test('aplica cupón de importe fijo', () => {
  const totals = pricing.calculate(
    state([item(3000)], { code: 'CINCO', type: 'fixed', value: 500 }),
  );

  assert.equal(totals.discountCents, 500);
  assert.equal(totals.discountedSubtotalCents, 2500);
  assert.equal(totals.totalCents, 3629);
});

test('rechaza cupones que no alcanzan el mínimo', () => {
  const totals = pricing.calculate(
    state([item(3000)], { code: 'AHORRA15', type: 'percent', value: 15 }),
  );

  assert.equal(totals.discountCents, 0);
  assert.equal(totals.couponApplied, false);
  assert.match(totals.couponError, /mínimo/);
});

test('el envío gratis se calcula sobre el subtotal con descuento', () => {
  const totals = pricing.calculate(
    state([item(5500)], { code: 'BIENVENIDO10', type: 'percent', value: 10 }),
  );

  assert.equal(totals.subtotalCents, 5500);
  assert.equal(totals.discountCents, 550);
  assert.equal(totals.discountedSubtotalCents, 4950);
  assert.equal(totals.shippingCents, 499);
  assert.equal(totals.freeShippingReached, false);
});

test('los descuentos nunca superan el subtotal', () => {
  const totals = pricing.calculate(
    state([item(1000)], { code: 'GIGANTE', type: 'fixed', value: 999999 }),
  );

  assert.equal(totals.discountCents, 1000);
  assert.equal(totals.discountedSubtotalCents, 0);
  assert.equal(totals.totalCents, totals.shippingCents + totals.taxCents);
});

test('permite registrar reglas nuevas por prioridad', () => {
  const engine = new PricingEngine();
  engine.register({
    name: 'diez-por-ciento',
    priority: 10,
    apply(context) {
      context.addDiscount({ label: '10 %', amountCents: context.subtotalCents * 0.1 });
    },
  });
  engine.register({
    name: 'envio-cero',
    priority: 20,
    apply(context) {
      context.shippingCents = 0;
    },
  });

  const totals = engine.calculate(state([item(2000)]));

  assert.equal(totals.discountCents, 200);
  assert.equal(totals.shippingCents, 0);
  assert.equal(totals.totalCents, 1800);
});
