import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cart from '../src/domain/cart.js';
import { priceCart } from '../src/domain/pricing.js';

const item = (sku, unitPrice, quantity) => ({ sku, name: sku, unitPrice, quantity });

test('setItem añade, actualiza y elimina sin mutar el original', () => {
  const c0 = Cart.createCart({ id: 'c1', now: 0 });
  const c1 = Cart.setItem(c0, item('A', 100, 2), { now: 1 });
  const c2 = Cart.setItem(c1, item('A', 100, 5), { now: 2 });
  const c3 = Cart.setItem(c2, item('A', 100, 0), { now: 3 });
  assert.equal(c0.items.length, 0);
  assert.equal(c1.items[0].quantity, 2);
  assert.equal(c2.items[0].quantity, 5);
  assert.equal(c3.items.length, 0);
});

test('respeta límites de líneas y unidades', () => {
  const limits = { maxLines: 2, maxQuantityPerLine: 3, maxCoupons: 1 };
  let c = Cart.createCart();
  c = Cart.setItem(c, item('A', 1, 1), { limits });
  c = Cart.setItem(c, item('B', 1, 1), { limits });
  assert.throws(() => Cart.setItem(c, item('C', 1, 1), { limits }), { code: 'LIMIT_EXCEEDED' });
  assert.throws(() => Cart.setItem(c, item('A', 1, 4), { limits }), { code: 'LIMIT_EXCEEDED' });
  c = Cart.addCoupon(c, 'x1', { limits });
  assert.deepEqual(c.coupons, ['X1']);
  assert.throws(() => Cart.addCoupon(c, 'x2', { limits }), { code: 'LIMIT_EXCEEDED' });
});

test('valida entradas', () => {
  const c = Cart.createCart();
  assert.throws(() => Cart.setItem(c, item('mal sku!', 1, 1)), { code: 'VALIDATION_ERROR' });
  assert.throws(() => Cart.setItem(c, item('A', 1.5, 1)), { code: 'VALIDATION_ERROR' });
  assert.throws(() => Cart.setItem(c, item('A', 1, -1)), { code: 'VALIDATION_ERROR' });
  assert.throws(() => Cart.removeItem(c, 'A'), { code: 'NOT_FOUND' });
});

test('mergedQuantities suma y limita', () => {
  let a = Cart.setItem(Cart.createCart(), item('A', 1, 98));
  let b = Cart.setItem(Cart.createCart(), item('A', 1, 5));
  b = Cart.setItem(b, item('B', 1, 2));
  const m = Cart.mergedQuantities(a, b);
  assert.equal(m.get('A'), 99);
  assert.equal(m.get('B'), 2);
});

test('priceCart: subtotal, 3x2, % pedido, envío e IVA', () => {
  let c = Cart.createCart();
  c = Cart.setItem(c, item('TAZA', 800, 3));    // 2400, 3x2 → -800
  c = Cart.setItem(c, item('CAM', 1500, 2));    // 3000
  const r = priceCart(c, {
    rules: [
      { id: 'r1', type: 'buy_x_pay_y', skus: ['TAZA'], buy: 3, pay: 2 },
      { id: 'r2', type: 'percent_off_order', percent: 10 },
    ],
    taxRate: 21,
    shipping: { flat: 499, freeOver: 5000 },
  });
  assert.equal(r.subtotal, 5400);
  // 5400 - 800 = 4600; -10% = 460 → 4140
  assert.equal(r.discountTotal, 1260);
  assert.equal(r.shipping, 499);                // 4140 < 5000
  assert.equal(r.tax, Math.round((4140 + 499) * 0.21));
  assert.equal(r.total, 4140 + 499 + r.tax);
  assert.equal(r.itemCount, 5);
});

test('priceCart: envío gratis, descuento fijo no supera subtotal, carrito vacío', () => {
  let c = Cart.setItem(Cart.createCart(), item('A', 300, 1));
  const r = priceCart(c, { rules: [{ id: 'f', type: 'fixed_off_order', amount: 1000 }], shipping: { flat: 499, freeOver: 0 } });
  assert.equal(r.discountTotal, 300);
  assert.equal(r.shipping, 0);
  assert.equal(r.total, 0);
  const empty = priceCart(Cart.createCart(), { shipping: { flat: 499 } });
  assert.equal(empty.total, 0);
});

test('priceCart ignora reglas de tipo desconocido y respeta minSubtotal', () => {
  const c = Cart.setItem(Cart.createCart(), item('A', 1000, 1));
  const r = priceCart(c, { rules: [{ id: 'x', type: 'nope' }, { id: 'm', type: 'fixed_off_order', amount: 500, minSubtotal: 3000 }] });
  assert.equal(r.discountTotal, 0);
});
