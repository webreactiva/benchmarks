import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Cart } from '../src/domain/cart.ts';
import { DomainError } from '../src/domain/errors.ts';
import { Money } from '../src/domain/money.ts';
import { PricingEngine } from '../src/domain/pricing.ts';
import { DEFAULT_COUPONS } from '../src/infrastructure/catalog/in-memory-catalog-inventory.ts';

describe('Dominio: Money & PricingEngine', () => {
  it('opera en unidades menores exactas sin errores de coma flotante y bloquea mezcla de divisas', () => {
    // En IEEE 754 clásico: 0.1 + 0.2 = 0.30000000000000004
    const a = Money.ofMinor(10, 'EUR');
    const b = Money.ofMinor(20, 'EUR');
    const sum = a.add(b);

    assert.equal(sum.amountMinor, 30);
    assert.equal(sum.format(), '0.30 EUR');

    const usd = Money.ofMinor(100, 'USD');
    assert.throws(
      () => sum.add(usd),
      (err: unknown) => err instanceof DomainError && err.code === 'CURRENCY_MISMATCH',
    );
  });

  it('aplica descuento automático por volumen, cupones con tope, IVA y envío gratuito sobre umbral', () => {
    const engine = new PricingEngine(DEFAULT_COUPONS);
    const cart = Cart.create({ userId: 'usr_1', currency: 'EUR' });

    // 10 unidades x 10.00 EUR = 100.00 EUR (10000 minor)
    // -> Activa dto volumen 5% (500 minor) => base restante 9500 minor
    // -> Cupón BIENVENIDA10 (10% sobre 9500) => 950 minor => base imponible 8550 minor
    // -> Base 85.50 EUR >= 50.00 EUR => envío gratis (0 minor)
    // -> IVA 21% sobre 8550 = round(8550 * 0.21) = 1796 minor
    // -> Total = 8550 + 1796 = 10346 minor (103.46 EUR)
    cart.upsertItem({
      sku: 'USB-CABLE',
      name: 'Cable Trenzado USB-C',
      unitPrice: Money.ofMinor(1000, 'EUR'),
      absoluteQuantity: 10,
    });
    cart.applyCoupon('BIENVENIDA10', engine);

    const view = cart.toView(engine);
    assert.equal(view.pricing.subtotal.amountMinor, 10000);
    assert.equal(view.pricing.discounts.length, 2);
    assert.equal(view.pricing.discountTotal.amountMinor, 1450);
    assert.equal(view.pricing.taxableAmount.amountMinor, 8550);
    assert.equal(view.pricing.shippingAmount.amountMinor, 0);
    assert.equal(view.pricing.taxAmount.amountMinor, 1796);
    assert.equal(view.pricing.grandTotal.amountMinor, 10346);
  });

  it('impide mutaciones sobre carritos expirados o ya finalizados', () => {
    const past = new Date('2025-01-01T00:00:00.000Z');
    const cart = Cart.create({ sessionId: 'sess_expired', now: past });

    const later = new Date('2025-02-01T00:00:00.000Z');
    assert.throws(
      () =>
        cart.upsertItem({
          sku: 'ITEM-1',
          name: 'Test',
          unitPrice: Money.ofMinor(500, 'EUR'),
          quantityDelta: 1,
          now: later,
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'CART_EXPIRED',
    );
  });
});
