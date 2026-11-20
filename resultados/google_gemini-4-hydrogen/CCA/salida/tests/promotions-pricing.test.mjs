import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BuyXGetYRule,
  Cart,
  CategoryTaxStrategy,
  FixedAmountDiscountRule,
  FreeThresholdShippingStrategy,
  Money,
  PercentageDiscountRule,
  PricingEngine,
  PromotionRegistry,
  TieredVolumeDiscountRule,
  WeightBasedShippingStrategy,
} from '../dist/index.js';

test('PricingEngine: promociones exclusivas vs acumulables, impuestos por categoría y envío', () => {
  const registry = new PromotionRegistry();

  // Promoción exclusiva 1: 10% en todo el carrito con cupón
  registry.register(
    new PercentageDiscountRule({
      id: 'promo_10pct',
      name: 'Cupón 10%',
      percentage: 10,
      couponCode: 'VIP10',
      stackable: false,
      priority: 10,
    }),
  );

  // Promoción exclusiva 2: 20 EUR de descuento desde 100 EUR (debería ganar sobre 10% si subtotal=120 EUR)
  registry.register(
    new FixedAmountDiscountRule({
      id: 'promo_20eur',
      name: '20 EUR DTO > 100',
      amount: Money.fromMajor(20, 'EUR'),
      minSubtotal: Money.fromMajor(100, 'EUR'),
      couponCode: 'SAVE20',
      stackable: false,
      priority: 20,
    }),
  );

  // Promoción automática acumulable: 3x2 en libros
  registry.register(
    new BuyXGetYRule({
      id: 'promo_3x2_books',
      name: '3x2 en Libros',
      buyQuantity: 2,
      freeQuantity: 1,
      categoryIds: ['libros'],
      stackable: true,
      priority: 30,
    }),
  );

  const engine = new PricingEngine({
    promotionRegistry: registry,
    taxStrategy: new CategoryTaxStrategy({
      STANDARD: 21,
      SUPER_REDUCED: 4,
    }),
    shippingStrategy: new FreeThresholdShippingStrategy({
      flatRate: Money.fromMajor(5.95, 'EUR'),
      freeThreshold: Money.fromMajor(100, 'EUR'),
    }),
  });

  const cart = Cart.create({ id: 'c_pricing', currency: 'EUR' });
  // 1x Auriculares 90 EUR (IVA 21%)
  cart.addItem({
    productId: 'p_auris',
    sku: 'AUR-1',
    name: 'Auriculares',
    categoryId: 'electronica',
    taxCategory: 'STANDARD',
    unitPrice: Money.fromMajor(90, 'EUR'),
    quantity: 1,
  });
  // 3x Libro 10 EUR = 30 EUR (IVA 4%, entra en 3x2 -> 10 EUR dto automático)
  cart.addItem({
    productId: 'p_libro',
    sku: 'LIB-1',
    name: 'Libro Clean Code',
    categoryId: 'libros',
    taxCategory: 'SUPER_REDUCED',
    unitPrice: Money.fromMajor(10, 'EUR'),
    quantity: 3,
  });

  cart.applyCoupon('VIP10');
  cart.applyCoupon('SAVE20');

  const summary = engine.calculate(cart);

  // Gross subtotal = 90 + 30 = 120 EUR
  assert.equal(summary.grossSubtotal.amountMinor, 12000);
  // Best exclusive: SAVE20 (20 EUR > 12 EUR de VIP10) + stackable 3x2 (10 EUR) = 30 EUR descuento total
  assert.equal(summary.totalDiscount.amountMinor, 3000);
  assert.equal(summary.netSubtotal.amountMinor, 9000);
  // Envío: netSubtotal 90 < 100 => 5.95 EUR
  assert.equal(summary.shipping.cost.amountMinor, 595);
  assert.equal(summary.shipping.freeShippingApplied, false);
  // Verificamos que se aplicaron 2 promociones
  assert.equal(summary.appliedPromotions.length, 2);
  assert.equal(summary.appliedPromotions[0]?.promotionId, 'promo_20eur');
  assert.equal(summary.appliedPromotions[1]?.promotionId, 'promo_3x2_books');
  // Grand total = netSubtotal + tax + shipping
  assert.equal(
    summary.grandTotal.amountMinor,
    summary.netSubtotal.amountMinor +
      summary.tax.totalTax.amountMinor +
      summary.shipping.cost.amountMinor,
  );
});

test('TieredVolumeDiscountRule y WeightBasedShippingStrategy', () => {
  const registry = new PromotionRegistry();
  registry.register(
    new TieredVolumeDiscountRule({
      id: 'tier_bulk',
      name: 'Descuento por volumen',
      tiers: [
        { minQuantity: 5, percentage: 10 },
        { minQuantity: 10, percentage: 25 },
      ],
    }),
  );

  const engine = new PricingEngine({
    promotionRegistry: registry,
    taxStrategy: new CategoryTaxStrategy({ STANDARD: 21 }),
    shippingStrategy: new WeightBasedShippingStrategy({
      baseRate: Money.fromMajor(3, 'EUR'),
      ratePerKg: Money.fromMajor(2, 'EUR'),
    }),
  });

  const cart = Cart.create({ id: 'c_bulk', currency: 'EUR' });
  cart.addItem({
    productId: 'p_pack',
    sku: 'PCK-1',
    name: 'Pack Café',
    categoryId: 'alimentacion',
    taxCategory: 'STANDARD',
    unitPrice: Money.fromMajor(10, 'EUR'),
    quantity: 10,
    weightGrams: 250, // 2.5 kg total -> ceil 3 kg -> 3 + 3*2 = 9 EUR envío
  });

  const summary = engine.calculate(cart);
  assert.equal(summary.grossSubtotal.amountMinor, 10000);
  assert.equal(summary.totalDiscount.amountMinor, 2500); // 25% por >= 10 uds
  assert.equal(summary.netSubtotal.amountMinor, 7500);
  assert.equal(summary.shipping.cost.amountMinor, 900);
});
