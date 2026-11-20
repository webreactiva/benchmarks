import test from 'node:test';
import assert from 'node:assert/strict';

import { Cart } from '../src/core/Cart.js';
import { CheckoutService } from '../src/core/CheckoutService.js';
import { MemoryStorageAdapter } from '../src/storage/MemoryStorageAdapter.js';
import { createDefaultPricing } from '../src/config/pricing.js';

const p1 = { id: 'p1', name: 'Producto 1', priceCents: 1000, category: 'Test' };

function createService() {
  return new CheckoutService({
    clock: () => new Date('2026-01-01T10:00:00.000Z'),
    idGenerator: () => 'ORD-TEST01',
  });
}

function createCart() {
  return new Cart({
    pricing: createDefaultPricing(),
    storage: new MemoryStorageAdapter(),
  });
}

test('crea un pedido con el resumen y vacía el carrito', () => {
  const cart = createCart();
  cart.add(p1, 2);

  const order = createService().process(cart, { customer: { email: 'demo@nebula.dev' } });

  assert.equal(order.id, 'ORD-TEST01');
  assert.equal(order.status, 'confirmed');
  assert.equal(order.createdAt, '2026-01-01T10:00:00.000Z');
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].qty, 2);
  assert.equal(order.items[0].lineTotalCents, 2000);
  assert.equal(order.totals.totalCents, 3024);
  assert.equal(order.customer.email, 'demo@nebula.dev');
  assert.equal(cart.isEmpty, true);
});

test('no permite finalizar un carrito vacío', () => {
  const cart = createCart();
  assert.throws(() => createService().process(cart), /vacío/);
});

test('cada pedido recibe un identificador único por defecto', () => {
  const service = new CheckoutService();
  const first = service.process(createCart().add(p1));
  const second = service.process(createCart().add(p1));

  assert.match(first.id, /^ORD-/);
  assert.notEqual(first.id, second.id);
});
