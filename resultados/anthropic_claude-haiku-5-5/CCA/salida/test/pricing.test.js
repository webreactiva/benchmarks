import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as cart from '../src/cart.js';
import {
  calculateTotals,
  percentOffSku,
  percentOffCart,
  fixedOffCart,
  buyXPayY,
} from '../src/pricing.js';
import { formatMoney, applyBps } from '../src/money.js';

const apple = { sku: 'APPLE', name: 'Manzana', unitPriceCents: 150, currency: 'EUR' };
const bread = { sku: 'BREAD', name: 'Pan', unitPriceCents: 299, currency: 'EUR' };

function build(items) {
  let c = cart.createCart({ id: 'c', currency: 'EUR' });
  for (const [product, qty] of items) c = cart.addItem(c, product, qty);
  return c;
}

describe('pricing', () => {
  test('sin reglas ni impuestos el total es el subtotal', () => {
    const t = calculateTotals(build([[apple, 2], [bread, 1]]));
    assert.equal(t.subtotalCents, 599);
    assert.equal(t.discountCents, 0);
    assert.equal(t.taxCents, 0);
    assert.equal(t.totalCents, 599);
    assert.equal(t.itemCount, 3);
  });

  test('impuestos en puntos básicos sobre la base imponible', () => {
    const t = calculateTotals(build([[apple, 10]]), { taxRateBps: 2100 }); // 21%
    assert.equal(t.subtotalCents, 1500);
    assert.equal(t.taxCents, 315);
    assert.equal(t.totalCents, 1815);
  });

  test('descuento por SKU', () => {
    const t = calculateTotals(build([[apple, 4], [bread, 1]]), {
      rules: [percentOffSku({ sku: 'APPLE', percentBps: 1000 })], // 10%
    });
    assert.equal(t.subtotalCents, 899);
    assert.equal(t.discountCents, 60);
    assert.equal(t.totalCents, 899 - 60);
  });

  test('descuento por umbral de carrito solo aplica si se alcanza el mínimo', () => {
    const rules = [percentOffCart({ minSubtotalCents: 1000, percentBps: 500 })];
    assert.equal(calculateTotals(build([[apple, 1]]), { rules }).discountCents, 0);
    assert.equal(calculateTotals(build([[bread, 4]]), { rules }).discountCents, 60); // 5% de 1196
  });

  test('descuento fijo con umbral', () => {
    const rules = [fixedOffCart({ minSubtotalCents: 500, amountCents: 100 })];
    assert.equal(calculateTotals(build([[bread, 1]]), { rules }).totalCents, 299);
    assert.equal(calculateTotals(build([[bread, 2]]), { rules }).totalCents, 598 - 100);
  });

  test('3x2 sobre un SKU', () => {
    const rules = [buyXPayY({ sku: 'APPLE', buy: 3, pay: 2 })];
    assert.equal(calculateTotals(build([[apple, 2]]), { rules }).discountCents, 0);
    assert.equal(calculateTotals(build([[apple, 3]]), { rules }).discountCents, 150);
    assert.equal(calculateTotals(build([[apple, 7]]), { rules }).discountCents, 300);
  });

  test('los descuentos nunca dejan el total negativo y se aplican en cadena', () => {
    const rules = [
      fixedOffCart({ minSubtotalCents: 0, amountCents: 1000, name: 'A' }),
      fixedOffCart({ minSubtotalCents: 0, amountCents: 1000, name: 'B' }),
    ];
    const t = calculateTotals(build([[apple, 1]]), { rules });
    assert.equal(t.totalCents, 0);
    assert.deepEqual(t.discounts.map((d) => d.name), ['A']);
    assert.equal(t.discountCents, 150);
  });

  test('las reglas se evalúan sobre el subtotal original y el resultado es entero', () => {
    const t = calculateTotals(build([[bread, 1]]), {
      rules: [percentOffCart({ minSubtotalCents: 0, percentBps: 3333 })],
      taxRateBps: 1000,
    });
    assert.ok(Number.isSafeInteger(t.discountCents));
    assert.ok(Number.isSafeInteger(t.taxCents));
    assert.equal(t.discountCents, applyBps(299, 3333));
  });

  test('parámetros inválidos fallan al construir la regla', () => {
    assert.throws(() => percentOffSku({ sku: 'X', percentBps: 20000 }));
    assert.throws(() => buyXPayY({ sku: 'X', buy: 2, pay: 2 }));
    assert.throws(() => fixedOffCart({ minSubtotalCents: 1.5, amountCents: 1 }));
  });
});

describe('money', () => {
  test('formatMoney usa los decimales de la moneda', () => {
    assert.match(formatMoney(1234, 'EUR', 'es-ES'), /12,34/);
    assert.match(formatMoney(1234, 'JPY', 'en-US'), /1,234/);
  });
});
