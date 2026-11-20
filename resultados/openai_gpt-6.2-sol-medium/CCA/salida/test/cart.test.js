import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalog, sampleItems } from '../public/js/catalog.js';
import { applyCoupon, normalizeCart, quoteCart, readCart, serializeCart, setQuantity } from '../public/js/cart.js';

const sample = () => normalizeCart({ items: sampleItems }, catalog);

test('calculates totals in cents and switches to free shipping at the threshold', () => {
  const cart = sample();
  const initial = quoteCart(cart, catalog);
  assert.equal(initial.count, 3);
  assert.equal(initial.subtotal, 5800);
  assert.equal(initial.delivery, 495);
  assert.equal(initial.remaining, 1700);
  assert.equal(initial.total, 6295);

  const thresholdCatalog = new Map([['limite', { price: 7500, stock: 1 }]]);
  const threshold = normalizeCart({ items: { limite: 1 } }, thresholdCatalog);
  assert.equal(quoteCart(threshold, thresholdCatalog).delivery, 0);
  assert.equal(quoteCart(normalizeCart({}, catalog), catalog).total, 0);
});

test('validates the coupon and keeps the free delivery threshold based on subtotal', () => {
  const aboveThreshold = setQuantity(sample(), catalog, 'taza', 2);
  assert.equal(applyCoupon(aboveThreshold, 'desconocido'), null);
  const discounted = applyCoupon(aboveThreshold, ' savia10 ');
  const quote = quoteCart(discounted, catalog);
  assert.equal(quote.discount, 760);
  assert.equal(quote.delivery, 0);
  assert.equal(quote.total, 6840);
});

test('clamps quantity to stock and clears the coupon when the last item is removed', () => {
  const empty = normalizeCart({}, catalog);
  assert.equal(setQuantity(empty, catalog, 'taza', 1.5), empty);
  assert.equal(setQuantity(empty, catalog, 'desconocido', 1), empty);
  const full = setQuantity(empty, catalog, 'taza', 500);
  assert.equal(full.items.get('taza'), catalog.get('taza').stock);
  assert.equal(empty.items.size, 0);
  const discounted = applyCoupon(full, 'SAVIA10');
  const cleared = setQuantity(discounted, catalog, 'taza', 0);
  assert.equal(cleared.items.size, 0);
  assert.equal(cleared.coupon, '');
});

test('recovers invalid storage and keeps a deliberately empty cart across reloads', () => {
  const fallback = { items: sampleItems };
  assert.deepEqual(readCart('{', catalog, fallback), sample());
  assert.deepEqual(readCart('{"version":99}', catalog, fallback), sample());
  const empty = normalizeCart({}, catalog);
  assert.deepEqual(readCart(serializeCart(empty), catalog, fallback), empty);

  const saved = '{"version":1,"items":{"taza":99,"pano":-2,"vela":"1","retirado":2},"coupon":"SAVIA10"}';
  const restored = readCart(saved, catalog);
  assert.deepEqual([...restored.items], [['taza', catalog.get('taza').stock]]);
  assert.equal(restored.coupon, 'SAVIA10');
});
