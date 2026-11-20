import { describe, expect, it } from 'vitest';
import {
  CartConflictError,
  CartService,
  InMemoryCartRepository,
  InMemoryEventBus,
  InMemoryIdempotencyStore,
  InMemoryPricingRules,
  InMemoryProductCatalog,
  InMemoryStockManager,
  defaultCartPolicies,
  money,
  systemClock,
  uuidGenerator,
  type CartRepository,
  type ProductCatalog,
} from '../src/index.js';

const buildService = (
  overrides: {
    carts?: CartRepository;
    catalog?: ProductCatalog;
  } = {},
) => {
  const carts = overrides.carts ?? new InMemoryCartRepository();
  const catalog = overrides.catalog ?? new InMemoryProductCatalog();
  const events = new InMemoryEventBus();
  const stock = new InMemoryStockManager({ 'sku-espresso': 10, 'sku-bolas': 100 }, uuidGenerator);

  const service = new CartService(
    {
      carts,
      catalog,
      rules: new InMemoryPricingRules(),
      stock,
      events,
      clock: systemClock,
      ids: uuidGenerator,
    },
    {
      policies: defaultCartPolicies,
      shipping: {
        flatAmount: money(499, 'EUR'),
        freeAbove: money(5000, 'EUR'),
        taxRate: 0.21,
      },
      currency: 'EUR',
      writeRetries: 5,
    },
  );

  return { service, carts, catalog, events, stock };
};

const customer = { customerId: 'customer-1' };

describe('cart service', () => {
  it('creates a cart and adds items', async () => {
    const { service } = buildService();
    const created = await service.createCart(customer.customerId);

    const view = await service.addItem(
      created.cart.id,
      { productId: 'sku-espresso', quantity: 2 },
      customer,
    );

    expect(view.cart.lines).toHaveLength(1);
    expect(view.totals.subtotal.amount).toBe(2580);
  });

  it('rejects an unknown product', async () => {
    const { service } = buildService();
    const created = await service.createCart(customer.customerId);

    await expect(
      service.addItem(created.cart.id, { productId: 'nope', quantity: 1 }, customer),
    ).rejects.toThrow(/not found/i);
  });

  it('does not allow a customer to read the cart of another customer', async () => {
    const { service } = buildService();
    const created = await service.createCart('customer-1');

    await expect(service.getCart(created.cart.id, { customerId: 'customer-2' })).rejects.toThrow(
      /another customer/i,
    );
  });

  it('claims a guest cart on the first write of an authenticated customer', async () => {
    const { service } = buildService();
    const guest = await service.createCart(null);
    await service.addItem(
      guest.cart.id,
      { productId: 'sku-espresso', quantity: 1 },
      {
        customerId: null,
      },
    );

    const claimed = await service.addItem(
      guest.cart.id,
      { productId: 'sku-bolas', quantity: 1 },
      customer,
    );
    expect(claimed.cart.customerId).toBe('customer-1');
  });

  it('resolves the write conflicts by replaying the mutation', async () => {
    const { service, carts } = buildService();
    const created = await service.createCart(customer.customerId);

    // Simulates a concurrent writer: the stored version moves forward while
    // the service is mutating its own snapshot.
    const originalSave = carts.save.bind(carts);
    let interfered = false;
    carts.save = async (cart, expectedVersion) => {
      if (!interfered) {
        interfered = true;
        await originalSave({ ...cart }, expectedVersion);
      }
      return originalSave(cart, expectedVersion);
    };

    const view = await service.addItem(
      created.cart.id,
      { productId: 'sku-espresso', quantity: 1 },
      customer,
    );

    expect(view.cart.lines).toHaveLength(1);
    expect(view.cart.version).toBeGreaterThan(1);
  });

  it('fails when the conflict cannot be resolved', async () => {
    const { service, carts } = buildService();
    const created = await service.createCart(customer.customerId);

    carts.save = async () => {
      throw new CartConflictError(created.cart.id, 0, 99);
    };

    await expect(
      service.addItem(created.cart.id, { productId: 'sku-espresso', quantity: 1 }, customer),
    ).rejects.toThrow(CartConflictError);
  });

  it('merges the guest cart into the customer cart', async () => {
    const { service } = buildService();
    const guest = await service.createCart(null);
    await service.addItem(
      guest.cart.id,
      { productId: 'sku-espresso', quantity: 2 },
      {
        customerId: null,
      },
    );

    const target = await service.createCart(customer.customerId);
    await service.addItem(target.cart.id, { productId: 'sku-espresso', quantity: 1 }, customer);

    const merged = await service.mergeCarts(guest.cart.id, target.cart.id, customer);
    expect(merged.cart.lines[0]?.quantity).toBe(3);

    const guestAfter = await service.getCart(guest.cart.id, { customerId: null });
    expect(guestAfter.cart.status).toBe('converted');
  });

  it('publishes the domain events', async () => {
    const { service, events } = buildService();
    const received: string[] = [];
    await events.subscribe((event) => received.push(event.type));

    const created = await service.createCart(customer.customerId);
    await service.addItem(created.cart.id, { productId: 'sku-espresso', quantity: 1 }, customer);
    await service.removeItem(created.cart.id, 'sku-espresso', customer);

    expect(received).toEqual(['cart.created', 'cart.item_added', 'cart.item_removed']);
  });

  it('checks out and reserves the stock', async () => {
    const { service, stock } = buildService();
    const created = await service.createCart(customer.customerId);
    await service.addItem(created.cart.id, { productId: 'sku-espresso', quantity: 2 }, customer);

    const result = await service.checkout(created.cart.id, customer);

    expect(result.cart.status).toBe('converted');
    expect(result.reservationId).toBeTruthy();
    expect(await stock.available('sku-espresso')).toBe(8);
  });

  it('refuses to check out an empty cart', async () => {
    const { service } = buildService();
    const created = await service.createCart(customer.customerId);

    await expect(service.checkout(created.cart.id, customer)).rejects.toThrow(/empty/i);
  });

  it('applies and removes coupons', async () => {
    const { service } = buildService();
    const created = await service.createCart(customer.customerId);
    await service.addItem(created.cart.id, { productId: 'sku-tostado', quantity: 1 }, customer);

    const withCoupon = await service.applyCoupon(created.cart.id, 'BIENVENIDA10', customer);
    expect(withCoupon.totals.couponDiscount.amount).toBe(345);

    const withoutCoupon = await service.removeCoupon(created.cart.id, 'BIENVENIDA10', customer);
    expect(withoutCoupon.totals.couponDiscount.amount).toBe(0);
  });

  it('keeps the idempotency store usable', async () => {
    const store = new InMemoryIdempotencyStore();
    expect(await store.claim('k', 'hash', 60)).toBe('claimed');
    expect(await store.claim('k', 'hash', 60)).toBe('replay');
    expect(await store.claim('k', 'other', 60)).toBe('conflict');
  });
});
