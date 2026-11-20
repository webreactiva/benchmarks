import { describe, expect, it } from 'vitest';
import type { CartItemView } from '../src/domain/cart.js';
import { PricingService, type PricingConfig } from '../src/services/pricing-service.js';

const config: PricingConfig = {
  taxRate: 0.21,
  shippingCents: 499,
  freeShippingThresholdCents: 5000,
  discounts: {
    DIEZ: { code: 'DIEZ', type: 'percent', value: 10 },
    CINCO: { code: 'CINCO', type: 'fixed', value: 500, minSubtotalCents: 2500 },
  },
};

const pricing = new PricingService(config);

const item = (unitPriceCents: number, quantity = 1): CartItemView => ({
  productId: 'p-x',
  name: 'Producto X',
  emoji: '📦',
  unitPriceCents,
  quantity,
  lineTotalCents: unitPriceCents * quantity,
  stock: 99,
});

describe('PricingService', () => {
  it('carrito vacío: todo a cero y sin envío', () => {
    const summary = pricing.price([], null);
    expect(summary.subtotalCents).toBe(0);
    expect(summary.discountCents).toBe(0);
    expect(summary.shippingCents).toBe(0);
    expect(summary.taxCents).toBe(0);
    expect(summary.totalCents).toBe(0);
  });

  it('calcula subtotal, envío gratis por encima del umbral e IVA redondeado', () => {
    // 2 × 29,99 = 59,98 → envío gratis (≥ 50 €); IVA = round(5998 × 0,21) = 1260
    const summary = pricing.price([item(2999, 2)], null);
    expect(summary.subtotalCents).toBe(5998);
    expect(summary.shippingCents).toBe(0);
    expect(summary.taxCents).toBe(1260);
    expect(summary.totalCents).toBe(7258);
  });

  it('cobra envío por debajo del umbral', () => {
    // 29,99 + 4,99 = 34,98 gravable; IVA = round(734,58) = 735; total 4233
    const summary = pricing.price([item(2999)], null);
    expect(summary.shippingCents).toBe(499);
    expect(summary.taxCents).toBe(735);
    expect(summary.totalCents).toBe(4233);
  });

  it('aplica descuento porcentual y redondea a céntimos enteros', () => {
    // 9,99 − 10 % = 100 céntimos de descuento; total = 899 + 499 + 294 = 1692
    const summary = pricing.price([item(999)], 'DIEZ');
    expect(summary.discountCode).toBe('DIEZ');
    expect(summary.discountCents).toBe(100);
    expect(summary.totalCents).toBe(1692);
  });

  it('descuento fijo: no aplica bajo el mínimo y nunca supera el subtotal', () => {
    const below = pricing.price([item(2000)], 'CINCO'); // 20 € < mínimo 25 €
    expect(below.discountCode).toBeNull();
    expect(below.discountCents).toBe(0);

    const applied = pricing.price([item(4000)], 'CINCO'); // 40 € ≥ 25 €
    expect(applied.discountCode).toBe('CINCO');
    expect(applied.discountCents).toBe(500);
    expect(applied.totalCents).toBe(4839);
  });

  it('el envío gratis se evalúa sobre el importe YA descontado', () => {
    // 55 € − 10 % = 49,50 € < 50 € → se paga el envío
    const summary = pricing.price([item(5500)], 'DIEZ');
    expect(summary.discountCents).toBe(550);
    expect(summary.shippingCents).toBe(499);
  });

  it('findDiscount normaliza espacios y mayúsculas', () => {
    expect(pricing.findDiscount(' diez ')?.code).toBe('DIEZ');
    expect(pricing.findDiscount('NOEXISTE')).toBeNull();
  });
});
