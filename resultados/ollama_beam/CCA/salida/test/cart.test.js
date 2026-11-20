const test = require('node:test');
const assert = require('node:assert/strict');
const { CartManager, InMemoryInventory } = require('../src');

test('add and totals', async () => {
  const m = new CartManager({ inventory: new InMemoryInventory({ p1: 10 }) });
  const cart = await m.createCart({ userId: 'u1' });
  m.registerCoupon('SAVE10', { type: 'percent', value: 10 });
  await m.addItem(cart.id, { productId: 'p1', name: 'Widget', price: 10, quantity: 2 });
  await m.applyCoupon(cart.id, 'SAVE10');
  const c = (await m.getCart(cart.id)).toJSON();
  assert.equal(c.subtotal, 20);
  assert.equal(c.discountTotal, 2);
  assert.equal(c.total, 18);
  assert.equal(c.itemCount, 2);
});

test('stock check', async () => {
  const m = new CartManager({ inventory: new InMemoryInventory({ p1: 1 }) });
  const cart = await m.createCart({ userId: 'u1' });
  await assert.rejects(() => m.addItem(cart.id, { productId: 'p1', quantity: 2, price: 5, name: 'x' }));
});

test('remove and clear', async () => {
  const m = new CartManager();
  const cart = await m.createCart({ userId: 'u1' });
  await m.addItem(cart.id, { productId: 'p1', price: 5, quantity: 1, name: 'x' });
  await m.updateQuantity(cart.id, 'p1', 0);
  const c = (await m.getCart(cart.id)).toJSON();
  assert.equal(c.items.length, 0);
});
