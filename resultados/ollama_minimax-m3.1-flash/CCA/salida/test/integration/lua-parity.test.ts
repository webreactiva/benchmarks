import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { computeTotals, proratePromo } from '../../src/domain/pricing.js';
import { MemoryCatalog } from '../../src/infrastructure/catalog.js';
import { RedisCartRepository } from '../../src/infrastructure/redis-cart-repository.js';
import type { Cart } from '../../src/domain/cart.js';

let harness: TestApp;

/**
 * El cálculo de precios está duplicado: en TypeScript (para el repositorio en
 * memoria y para validar) y en Lua (para que la mutación sea atómica dentro
 * de Redis). Este test comprueba que ambas implementaciones producen
 * exactamente los mismos importes.
 */
describe('paridad entre el motor de precios de TS y el script Lua', () => {
  beforeAll(async () => {
    harness = await createTestApp();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('coincide en carritos con descuentos por volumen, cupones y cambios de cantidad', async () => {
    const repository = new RedisCartRepository(harness.redis, harness.config);
    const catalog = new MemoryCatalog();

    const cart: Cart = {
      id: `paridad-${Date.now()}`,
      ownerId: null,
      sessionId: 'paridad',
      currency: 'EUR',
      status: 'active',
      items: [],
      promoCodes: [],
      totals: {
        currency: 'EUR',
        subtotalCents: 0,
        discountCents: 0,
        promoCents: 0,
        shippingCents: 0,
        taxCents: 0,
        totalCents: 0,
        itemCount: 0,
      },
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    await repository.create(cart);

    const tea = await catalog.getProduct({ productId: 'prod-tea' });
    const lamp = await catalog.getProduct({ productId: 'prod-lamp' });
    const notebook = await catalog.getProduct({ productId: 'prod-notebook' });
    expect(tea && lamp && notebook).toBeTruthy();

    const lineFor = (
      product: NonNullable<Awaited<ReturnType<typeof catalog.getProduct>>>,
      quantity: number,
    ) => ({
      lineId: `${product.productId}-${product.variantId ?? 'base'}`,
      productId: product.productId,
      variantId: product.variantId,
      sku: product.sku,
      name: product.name,
      unitPriceCents: product.unitPriceCents,
      quantity,
      discountBps: 0,
      discountCents: 0,
      promoCents: 0,
      lineTotalCents: 0,
      volumeBreaks: product.volumeBreaks,
      metadata: {},
    });

    // 1) tres artículos con descuento por volumen
    let outcome = await repository.mutate(cart.id, null, {
      kind: 'add_item',
      item: lineFor(tea!, 3),
    });
    expect(outcome.status).toBe('ok');

    // 2) cupón porcentual
    outcome = await repository.mutate(cart.id, null, { kind: 'apply_promo', code: 'WELCOME10' });
    expect(outcome.status).toBe('ok');

    // 3) cantidad updated en otra línea
    outcome = await repository.mutate(cart.id, null, {
      kind: 'add_item',
      item: lineFor(lamp!, 1),
    });
    expect(outcome.status).toBe('ok');

    outcome = await repository.mutate(cart.id, null, {
      kind: 'add_item',
      item: lineFor(notebook!, 12),
    });
    expect(outcome.status).toBe('ok');

    // 4) cambio de cantidad (dispara el recálculo de descuentos por volumen)
    outcome = await repository.mutate(cart.id, null, {
      kind: 'set_quantity',
      lineId: lineFor(tea!, 1).lineId,
      quantity: 2,
    });
    expect(outcome.status).toBe('ok');

    const luaCart = (outcome as { status: 'ok'; cart: Cart }).cart;

    // Se replica el cálculo en TypeScript con los mismos datos
    const tsItems = luaCart.items.map((item) => ({
      ...item,
      discountBps: item.volumeBreaks.reduce(
        (best, br) => (item.quantity >= br.minQuantity && br.discountBps > best ? br.discountBps : best),
        0,
      ),
    }));
    const expectedTotals = computeTotals({
      items: tsItems,
      promoCodes: luaCart.promoCodes,
      currency: 'EUR',
      shippingFlatCents: harness.config.pricing.shippingFlatCents,
      freeShippingThresholdCents: harness.config.pricing.freeShippingThresholdCents,
      taxBps: harness.config.pricing.taxBps,
      promos: harness.config.pricing.promos,
    });

    expect(luaCart.totals.subtotalCents).toBe(expectedTotals.subtotalCents);
    expect(luaCart.totals.discountCents).toBe(expectedTotals.discountCents);
    expect(luaCart.totals.promoCents).toBe(expectedTotals.promoCents);
    expect(luaCart.totals.shippingCents).toBe(expectedTotals.shippingCents);
    expect(luaCart.totals.taxCents).toBe(expectedTotals.taxCents);
    expect(luaCart.totals.totalCents).toBe(expectedTotals.totalCents);
    expect(luaCart.totals.itemCount).toBe(expectedTotals.itemCount);

    // y el prorrateo del cupón por línea coincide
    const prorated = proratePromo(tsItems, expectedTotals);
    for (let i = 0; i < luaCart.items.length; i += 1) {
      expect(luaCart.items[i]!.promoCents).toBe(prorated[i]!.promoCents);
      expect(luaCart.items[i]!.lineTotalCents).toBe(prorated[i]!.lineTotalCents);
    }
  });
});
