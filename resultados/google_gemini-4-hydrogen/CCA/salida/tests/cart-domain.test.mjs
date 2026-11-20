import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Cart,
  CartInactiveError,
  DomainError,
  Money,
} from '../dist/index.js';

const sampleProps = (overrides = {}) => ({
  productId: 'prod_camiseta',
  variantId: 'talla_M',
  sku: 'CAM-M-01',
  name: 'Camiseta Técnica',
  categoryId: 'ropa',
  taxCategory: 'STANDARD',
  unitPrice: Money.fromMajor(25, 'EUR'),
  quantity: 2,
  weightGrams: 200,
  ...overrides,
});

test('Cart: creación, alta de variantes, actualización y eliminación', () => {
  const cart = Cart.create({ id: 'c1', ownerId: 'u1', currency: 'EUR' });
  assert.equal(cart.version, 1);
  assert.equal(cart.isEmpty(), true);

  const lineM = cart.addItem(sampleProps());
  const lineL = cart.addItem(sampleProps({ variantId: 'talla_L', sku: 'CAM-L-01', quantity: 1 }));

  assert.equal(cart.lineCount, 2);
  assert.equal(cart.totalQuantity, 3);
  assert.equal(cart.subtotal().amountMinor, 7500);
  assert.equal(cart.version, 3);

  // Añadir misma variante suma cantidad
  cart.addItem(sampleProps({ quantity: 1 }));
  assert.equal(cart.getItem('prod_camiseta', 'talla_M')?.quantity, 3);
  assert.equal(cart.version, 4);

  // Actualizar a 0 elimina la línea
  const removed = cart.updateItemQuantity(lineL.lineKey, 0);
  assert.equal(removed, null);
  assert.equal(cart.lineCount, 1);
  assert.equal(cart.getItem('prod_camiseta', 'talla_M')?.lineKey, lineM.lineKey);

  const events = cart.pullDomainEvents();
  assert.deepEqual(
    events.map((e) => e.type),
    [
      'CartCreated',
      'CartItemAdded',
      'CartItemAdded',
      'CartItemQuantityUpdated',
      'CartItemRemoved',
    ],
  );
  assert.equal(cart.pullDomainEvents().length, 0);
});

test('Cart: respeta límites máximos de líneas y cantidad por línea', () => {
  const cart = Cart.create({
    id: 'c_limits',
    currency: 'EUR',
    limits: { maxLineItems: 1, maxQuantityPerLine: 5 },
  });

  cart.addItem(sampleProps({ quantity: 4 }));
  assert.throws(
    () => cart.addItem(sampleProps({ productId: 'otro', sku: 'OTRO-1', quantity: 1 })),
    (err) => err instanceof DomainError && err.code === 'MAX_CART_LINES_EXCEEDED',
  );

  assert.throws(
    () => cart.addItem(sampleProps({ quantity: 2 })),
    (err) => err instanceof DomainError && err.code === 'INVALID_QUANTITY',
  );
});

test('Cart: expiración TTL y bloqueo tras checkout', () => {
  const t0 = new Date('2026-01-01T10:00:00Z');
  const cart = Cart.create({ id: 'c_ttl', currency: 'EUR', ttlMs: 60_000, now: t0 });
  cart.addItem(sampleProps({ quantity: 1 }), { now: t0 });

  const tExpired = new Date('2026-01-01T10:02:00Z');
  assert.equal(cart.isExpired(tExpired), true);
  assert.throws(
    () => cart.addItem(sampleProps({ quantity: 1 }), { now: tExpired }),
    CartInactiveError,
  );
});

test('Cart: round-trip de snapshot y fusión de carritos', () => {
  const userCart = Cart.create({ id: 'c_user', ownerId: 'user_42', currency: 'EUR' });
  userCart.addItem(sampleProps({ quantity: 1 }));

  const guestCart = Cart.create({ id: 'c_guest', currency: 'EUR' });
  guestCart.addItem(sampleProps({ quantity: 2 }));
  guestCart.addItem(
    sampleProps({
      productId: 'prod_gorra',
      variantId: undefined,
      sku: 'GOR-01',
      name: 'Gorra',
      quantity: 1,
    }),
  );
  guestCart.applyCoupon('VERANO10');

  const mergedCount = userCart.mergeFrom(guestCart);
  assert.equal(mergedCount, 2);
  assert.equal(guestCart.status, 'MERGED');
  assert.equal(userCart.getItem('prod_camiseta', 'talla_M')?.quantity, 3);
  assert.equal(userCart.getItem('prod_gorra')?.quantity, 1);
  assert.deepEqual(userCart.couponCodes, ['VERANO10']);

  const restored = Cart.fromSnapshot(userCart.toSnapshot());
  assert.equal(restored.id, userCart.id);
  assert.equal(restored.version, userCart.version);
  assert.equal(restored.subtotal().amountMinor, userCart.subtotal().amountMinor);
});
