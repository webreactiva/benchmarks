import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CartService,
  CategoryTaxStrategy,
  ConcurrencyConflictError,
  FreeThresholdShippingStrategy,
  InMemoryCartRepository,
  InMemoryCatalogAdapter,
  InMemoryEventBus,
  InMemoryIdempotencyStore,
  InMemoryInventoryAdapter,
  InsufficientStockError,
  Money,
  PercentageDiscountRule,
  PricingEngine,
  PromotionError,
  PromotionRegistry,
} from '../dist/index.js';

function createTestHarness() {
  const cartRepository = new InMemoryCartRepository();
  const catalog = new InMemoryCatalogAdapter([
    {
      productId: 'p_laptop',
      sku: 'LAP-001',
      name: 'Portátil Pro 14"',
      categoryId: 'tech',
      taxCategory: 'STANDARD',
      unitPrice: Money.fromMajor(1000, 'EUR'),
      weightGrams: 1400,
      active: true,
    },
    {
      productId: 'p_mouse',
      sku: 'MOU-001',
      name: 'Ratón Inalámbrico',
      categoryId: 'tech',
      taxCategory: 'STANDARD',
      unitPrice: Money.fromMajor(40, 'EUR'),
      weightGrams: 120,
      active: true,
    },
  ]);

  const inventory = new InMemoryInventoryAdapter({
    'LAP-001': 5,
    'MOU-001': 10,
  });

  const promotionRegistry = new PromotionRegistry();
  promotionRegistry.register(
    new PercentageDiscountRule({
      id: 'promo_welcome',
      name: 'Bienvenida 10%',
      percentage: 10,
      couponCode: 'WELCOME10',
    }),
  );

  const pricingEngine = new PricingEngine({
    promotionRegistry,
    taxStrategy: new CategoryTaxStrategy({ STANDARD: 21 }),
    shippingStrategy: new FreeThresholdShippingStrategy({
      flatRate: Money.fromMajor(7.99, 'EUR'),
      freeThreshold: Money.fromMajor(500, 'EUR'),
    }),
  });

  const eventBus = new InMemoryEventBus();
  const idempotencyStore = new InMemoryIdempotencyStore();

  const service = new CartService({
    cartRepository,
    catalog,
    inventory,
    pricingEngine,
    promotionRegistry,
    eventBus,
    idempotencyStore,
  });

  return { service, cartRepository, inventory, eventBus };
}

test('CartService: flujo completo con cupón, idempotencia y checkout atómico', async () => {
  const { service, inventory, eventBus } = createTestHarness();

  const cart = await service.createCart({ ownerId: 'user_1', idempotencyKey: 'create-1' });
  const sameCart = await service.createCart({ ownerId: 'user_1', idempotencyKey: 'create-1' });
  assert.equal(sameCart.id, cart.id);

  // Añadir con idempotencia evita duplicar cantidad ante reintento de red
  await service.addItem({
    cartId: cart.id,
    productId: 'p_laptop',
    quantity: 1,
    idempotencyKey: 'add-lap-1',
  });
  const summaryAfterRetry = await service.addItem({
    cartId: cart.id,
    productId: 'p_laptop',
    quantity: 1,
    idempotencyKey: 'add-lap-1',
  });

  assert.equal(summaryAfterRetry.lines[0]?.quantity, 1);
  assert.equal(summaryAfterRetry.grossSubtotal.amountMinor, 100000);

  // Cupón inválido lanza PromotionError
  await assert.rejects(
    () => service.applyCoupon(cart.id, 'NO_EXISTE'),
    PromotionError,
  );

  const withCoupon = await service.applyCoupon(cart.id, 'welcome10');
  assert.equal(withCoupon.totalDiscount.amountMinor, 10000);
  assert.equal(withCoupon.netSubtotal.amountMinor, 90000);
  assert.equal(withCoupon.shipping.freeShippingApplied, true);

  // Checkout idempotente
  const receipt1 = await service.checkout({ cartId: cart.id, idempotencyKey: 'chk-1' });
  const receipt2 = await service.checkout({ cartId: cart.id, idempotencyKey: 'chk-1' });
  assert.equal(receipt1.orderId, receipt2.orderId);
  assert.equal(receipt1.grandTotalMinor, 90000 + Math.round(90000 * 0.21));

  // El inventario se descontó exactamente una vez
  assert.equal(await inventory.getAvailableStock('LAP-001'), 4);

  // El evento CartCheckedOut fue emitido
  assert.equal(
    eventBus.publishedEvents.some((e) => e.type === 'CartCheckedOut'),
    true,
  );
});

test('CartService: bloqueo optimista explícito y validación de stock', async () => {
  const { service } = createTestHarness();
  const cart = await service.createCart({ ownerId: 'user_2' });

  await service.addItem({ cartId: cart.id, productId: 'p_mouse', quantity: 2 });

  // Si un cliente envía una versión obsoleta explícitamente, falla con ConcurrencyConflictError
  await assert.rejects(
    () =>
      service.addItem({
        cartId: cart.id,
        productId: 'p_mouse',
        quantity: 1,
        expectedVersion: 1,
      }),
    ConcurrencyConflictError,
  );

  // Solicitar más stock del disponible falla con InsufficientStockError
  await assert.rejects(
    () =>
      service.addItem({
        cartId: cart.id,
        productId: 'p_laptop',
        quantity: 99,
      }),
    InsufficientStockError,
  );
});

test('CartService: reintento automático bajo escrituras concurrentes sin expectedVersion', async () => {
  const { service } = createTestHarness();
  const cart = await service.createCart({ ownerId: 'user_concurrent' });

  // Simulamos concurrencia ejecutando 5 incrementos en paralelo
  await Promise.all(
    Array.from({ length: 5 }, () =>
      service.addItem({
        cartId: cart.id,
        productId: 'p_mouse',
        quantity: 1,
      }),
    ),
  );

  const summary = await service.getCartSummary(cart.id);
  assert.equal(summary.lines[0]?.quantity, 5);
});

test('CartService: compensación Saga en checkout si falla el guardado del carrito', async () => {
  const { service, cartRepository, inventory } = createTestHarness();
  const cart = await service.createCart({ ownerId: 'user_saga' });
  await service.addItem({ cartId: cart.id, productId: 'p_laptop', quantity: 2 });

  assert.equal(await inventory.getAvailableStock('LAP-001'), 5);

  // Forzamos fallo de concurrencia enviando expectedVersion incorrecta
  await assert.rejects(
    () => service.checkout({ cartId: cart.id, expectedVersion: 1 }),
    ConcurrencyConflictError,
  );

  // Verificamos también fallo durante save tras reservar stock
  const originalSave = cartRepository.save.bind(cartRepository);
  cartRepository.save = async () => {
    throw new ConcurrencyConflictError(cart.id, 2, 99);
  };

  await assert.rejects(
    () => service.checkout({ cartId: cart.id }),
    ConcurrencyConflictError,
  );

  // Compensación: el stock debe permanecer intacto en 5
  assert.equal(await inventory.getAvailableStock('LAP-001'), 5);
  cartRepository.save = originalSave;
});

test('CartService: fusión de carrito de invitado al iniciar sesión y purga de expirados', async () => {
  const { service, cartRepository } = createTestHarness();

  const userCart = await service.createCart({ ownerId: 'user_99' });
  await service.addItem({ cartId: userCart.id, productId: 'p_mouse', quantity: 2 });

  const guestCart = await service.createCart({ ownerId: null });
  await service.addItem({ cartId: guestCart.id, productId: 'p_mouse', quantity: 3 });
  await service.addItem({ cartId: guestCart.id, productId: 'p_laptop', quantity: 1 });

  const mergedSummary = await service.mergeGuestCart({
    guestCartId: guestCart.id,
    userId: 'user_99',
  });

  assert.equal(mergedSummary.lines.length, 2);
  const mouseLine = mergedSummary.lines.find((l) => l.productId === 'p_mouse');
  assert.equal(mouseLine?.quantity, 5);

  const guestAfter = await service.getCart(guestCart.id);
  assert.equal(guestAfter.status, 'MERGED');

  // Probamos purga de carritos expirados
  const expiredCart = await service.createCart({ ttlMs: 10 });
  const purged = await cartRepository.purgeExpired(new Date(Date.now() + 1000));
  assert.equal(purged, 1);
  assert.equal(await cartRepository.findById(expiredCart.id), null);
});
