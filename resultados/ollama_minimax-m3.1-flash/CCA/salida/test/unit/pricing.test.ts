import { describe, expect, it } from 'vitest';
import { computeTotals, proratePromo } from '../../src/domain/pricing.js';
import type { CartItem } from '../../src/domain/cart.js';
import type { PromoRule } from '../../src/config.js';

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    lineId: 'line-1',
    productId: 'prod-1',
    variantId: null,
    sku: 'SKU-1',
    name: 'Producto',
    unitPriceCents: 1_000,
    quantity: 1,
    discountBps: 0,
    discountCents: 0,
    promoCents: 0,
    lineTotalCents: 1_000,
    volumeBreaks: [],
    metadata: {},
    ...overrides,
  };
}

const promos: Record<string, PromoRule> = {
  WELCOME10: { type: 'percent', bps: 1_000, maxDiscountCents: 2_000 },
  SAVE5: { type: 'fixed', amountCents: 500, minSubtotalCents: 3_000 },
};

const base = {
  currency: 'EUR' as const,
  shippingFlatCents: 499,
  freeShippingThresholdCents: 5_000,
  taxBps: 2_100,
  promos,
};

describe('motor de precios', () => {
  it('calcula subtotal, envío e IVA sin descuentos', () => {
    const totals = computeTotals({ ...base, items: [item({ unitPriceCents: 2_500, quantity: 2 })], promoCodes: [] });

    expect(totals.subtotalCents).toBe(5_000);
    expect(totals.discountCents).toBe(0);
    expect(totals.shippingCents).toBe(0); // envío gratis a partir de 50,00 €
    expect(totals.taxCents).toBe(1_050);
    expect(totals.totalCents).toBe(6_050);
    expect(totals.itemCount).toBe(2);
  });

  it('aplica el envío por debajo del umbral gratuito', () => {
    const totals = computeTotals({ ...base, items: [item({ unitPriceCents: 1_000 })], promoCodes: [] });

    expect(totals.shippingCents).toBe(499);
    expect(totals.taxCents).toBe(314); // floor(1499 * 21%)
    expect(totals.totalCents).toBe(1_813);
  });

  it('aplica descuentos de volumen por línea', () => {
    const totals = computeTotals({
      ...base,
      items: [item({ unitPriceCents: 1_000, quantity: 3, discountBps: 500 })],
      promoCodes: [],
    });

    expect(totals.subtotalCents).toBe(3_000);
    expect(totals.discountCents).toBe(150);
    expect(totals.shippingCents).toBe(499);
  });

  it('aplica cupones porcentuales con tope', () => {
    const totals = computeTotals({
      ...base,
      items: [item({ unitPriceCents: 10_000, quantity: 1 })],
      promoCodes: ['WELCOME10'],
    });

    expect(totals.promoCents).toBe(1_000); // 10 % con tope de 20,00 €
    expect(totals.taxCents).toBe(1_890);
    expect(totals.totalCents).toBe(10_890);
  });

  it('ignora cupones de importe fijo por debajo del mínimo', () => {
    const totals = computeTotals({
      ...base,
      items: [item({ unitPriceCents: 1_000 })],
      promoCodes: ['SAVE5'],
    });

    expect(totals.promoCents).toBe(0);
  });

  it('aplica cupones de importe fijo sobre el mínimo', () => {
    const totals = computeTotals({
      ...base,
      items: [item({ unitPriceCents: 3_000 })],
      promoCodes: ['SAVE5'],
    });

    expect(totals.promoCents).toBe(500);
    expect(totals.shippingCents).toBe(499); // 3000 - 500 = 2500 < 5000
    expect(totals.taxCents).toBe(629);
    expect(totals.totalCents).toBe(3_628);
  });

  it('prorratea el cupón sin perder céntimos entre líneas', () => {
    const items = [
      item({ lineId: 'a', unitPriceCents: 999, quantity: 1 }),
      item({ lineId: 'b', unitPriceCents: 1_001, quantity: 1 }),
      item({ lineId: 'c', unitPriceCents: 1_000, quantity: 1 }),
    ];
    const totals = computeTotals({ ...base, items, promoCodes: ['WELCOME10'] });
    const prorated = proratePromo(items, totals);

    const sum = prorated.reduce((acc, i) => acc + i.promoCents, 0);
    expect(sum).toBe(totals.promoCents);
    const lineSum = prorated.reduce((acc, i) => acc + i.lineTotalCents, 0);
    expect(lineSum).toBe(totals.subtotalCents - totals.discountCents - totals.promoCents);
  });
});
