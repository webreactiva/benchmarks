import test from 'node:test';
import assert from 'node:assert/strict';

import { Cart } from '../src/core/Cart.js';
import { MemoryStorageAdapter } from '../src/storage/MemoryStorageAdapter.js';
import { createDefaultPricing } from '../src/config/pricing.js';

const p1 = { id: 'p1', name: 'Producto 1', priceCents: 1000, category: 'Test' };
const p2 = { id: 'p2', name: 'Producto 2', priceCents: 2500, category: 'Test' };

function createCart(options = {}) {
  return new Cart({ pricing: createDefaultPricing(), ...options });
}

test('añade productos y agrupa las cantidades del mismo id', () => {
  const cart = createCart();
  cart.add(p1);
  cart.add(p1, 2);

  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].qty, 3);
  assert.equal(cart.count, 3);
});

test('añade productos distintos como líneas separadas', () => {
  const cart = createCart();
  cart.add(p1);
  cart.add(p2, 2);

  assert.equal(cart.items.length, 2);
  assert.equal(cart.count, 3);
  assert.equal(cart.items[1].lineTotalCents, 5000);
});

test('rechaza productos sin id', () => {
  const cart = createCart();
  assert.throws(() => cart.add({ name: 'Sin id' }), TypeError);
});

test('setQty con cero elimina la línea', () => {
  const cart = createCart();
  cart.add(p1, 2);
  cart.setQty('p1', 0);

  assert.equal(cart.isEmpty, true);
  assert.equal(cart.count, 0);
});

test('increment y decrement respetan los límites', () => {
  const cart = createCart();
  cart.add(p1, 98);
  cart.increment('p1', 5);

  assert.equal(cart.items[0].qty, 99);

  cart.increment('p1', -1000);
  assert.equal(cart.isEmpty, true);
});

test('remove elimina solo el producto indicado', () => {
  const cart = createCart();
  cart.add(p1);
  cart.add(p2);
  cart.remove('p1');

  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].product.id, 'p2');
});

test('clear vacía el carrito y el cupón', () => {
  const cart = createCart();
  cart.add(p1);
  cart.applyCoupon({ code: 'BIENVENIDO10' });
  cart.clear();

  assert.equal(cart.isEmpty, true);
  assert.equal(cart.coupon, null);
});

test('emite eventos change y de dominio', () => {
  const cart = createCart();
  const changes = [];
  const added = [];

  cart.on('change', (payload) => changes.push(payload.event));
  cart.on('cart:item-added', (payload) => added.push(payload));

  cart.add(p1, 2);

  assert.deepEqual(changes, ['cart:item-added']);
  assert.equal(added[0].productId, 'p1');
  assert.equal(added[0].qty, 2);
});

test('persiste y restaura el carrito mediante el adaptador de almacenamiento', () => {
  const storage = new MemoryStorageAdapter();
  const cart = createCart({ storage });
  cart.add(p1, 2);
  cart.add(p2);
  cart.applyCoupon({ code: 'BIENVENIDO10', type: 'percent', value: 10 });

  const restored = createCart({ storage });

  assert.equal(restored.items.length, 2);
  assert.equal(restored.items[0].qty, 2);
  assert.equal(restored.coupon.code, 'BIENVENIDO10');
  assert.equal(restored.count, 3);
});

test('hydrate ignora entradas corruptas o sin id', () => {
  const cart = createCart();
  cart.hydrate({
    items: [
      { product: { id: 'ok', name: 'Ok', priceCents: 500 }, qty: 2 },
      { product: { name: 'Sin id' }, qty: 1 },
      null,
    ],
    coupon: null,
  });

  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].product.id, 'ok');
  assert.equal(cart.items[0].qty, 2);
});
