import { describe, expect, it } from 'vitest';
import { priceCart, allocate } from '../src/application/pricing-engine.js';
import { addLine, applyCoupon, createCart, type Cart } from '../src/domain/cart.js';
import { money } from '../src/domain/money.js';
import type { CouponDefinition, Promotion, ShippingPolicy } from '../src/domain/coupon.js';

const NOW = '2024-01-01T00:00:00.000Z';
const NOW_DATE = new Date(NOW);

const shipping: ShippingPolicy = {
  flatAmount: money(499, 'EUR'),
  freeAbove: money(5000, 'EUR'),
  taxRate: 0.21,
};

const buildCart = (lines: { price: number; quantity: number }[]): Cart => {
  let cart = createCart({ id: 'cart', customerId: 'c1', currency: 'EUR', now: NOW });
  lines.forEach((line, index) => {
    cart = addLine(
      cart,
      {
        productId: `p${index}`,
        sku: `SKU-${index}`,
        name: `Producto ${index}`,
        unitPrice: money(line.price, 'EUR'),
        quantity: line.quantity,
        lineId: `line-${index}`,
      },
      NOW,
      {
        maxQuantityPerLine: 100,
        maxDistinctLines: 100,
        maxUnitsPerCart: 1000,
        mergeStrategy: 'sum',
        ttlSeconds: 60,
      },
    );
  });
  return cart;
};

describe('pricing engine', () => {
  it('computes an empty cart without shipping', () => {
    const totals = priceCart(
      { cart: buildCart([]), promotions: [], coupons: [], shipping },
      NOW_DATE,
    );
    expect(totals.subtotal.amount).toBe(0);
    expect(totals.shipping.amount).toBe(0);
    expect(totals.total.amount).toBe(0);
  });

  it('adds the shipping and the tax', () => {
    const totals = priceCart(
      { cart: buildCart([{ price: 1290, quantity: 2 }]), promotions: [], coupons: [], shipping },
      NOW_DATE,
    );

    expect(totals.subtotal.amount).toBe(2580);
    expect(totals.shipping.amount).toBe(499);
    expect(totals.taxableBase.amount).toBe(3079);
    expect(totals.tax.amount).toBe(647);
    expect(totals.total.amount).toBe(3726);
  });

  it('grants free shipping above the threshold', () => {
    const totals = priceCart(
      { cart: buildCart([{ price: 6000, quantity: 1 }]), promotions: [], coupons: [], shipping },
      NOW_DATE,
    );
    expect(totals.shipping.amount).toBe(0);
    expect(totals.freeShipping).toBe(true);
  });

  it('applies a percentage promotion with a maximum discount', () => {
    const promotion: Promotion = {
      id: 'p',
      type: 'percentage',
      value: 0.1,
      description: '10%',
      maxDiscount: money(500, 'EUR'),
      minSubtotal: money(1000, 'EUR'),
      priority: 1,
    };

    const totals = priceCart(
      {
        cart: buildCart([{ price: 10000, quantity: 1 }]),
        promotions: [promotion],
        coupons: [],
        shipping,
      },
      NOW_DATE,
    );

    expect(totals.promotionDiscount.amount).toBe(500);
    expect(totals.total).toBeDefined();
  });

  it('ignores a promotion when the minimum subtotal is not reached', () => {
    const promotion: Promotion = {
      id: 'p',
      type: 'percentage',
      value: 0.1,
      description: '10%',
      minSubtotal: money(5000, 'EUR'),
      priority: 1,
    };

    const totals = priceCart(
      {
        cart: buildCart([{ price: 1000, quantity: 1 }]),
        promotions: [promotion],
        coupons: [],
        shipping,
      },
      NOW_DATE,
    );
    expect(totals.promotionDiscount.amount).toBe(0);
  });

  it('does not grant free shipping when the minimum subtotal is not reached', () => {
    const promotion: Promotion = {
      id: 'p',
      type: 'free_shipping',
      value: 0,
      description: 'envío gratis',
      minSubtotal: money(5000, 'EUR'),
      priority: 1,
    };

    const totals = priceCart(
      {
        cart: buildCart([{ price: 1000, quantity: 1 }]),
        promotions: [promotion],
        coupons: [],
        shipping,
      },
      NOW_DATE,
    );
    expect(totals.shipping.amount).toBe(499);
    expect(totals.freeShipping).toBe(false);
  });

  it('applies a coupon on top of the subtotal', () => {
    const coupon: CouponDefinition = {
      code: 'WELCOME',
      type: 'percentage',
      value: 0.1,
      description: '10%',
      active: true,
    };

    const cart = applyCoupon(buildCart([{ price: 3450, quantity: 1 }]), coupon, NOW);
    const totals = priceCart({ cart, promotions: [], coupons: [coupon], shipping }, NOW_DATE);

    expect(totals.couponDiscount.amount).toBe(345);
    expect(totals.appliedCoupons[0]?.discountAmount.amount).toBe(345);
    expect(totals.items[0]?.discount.amount).toBe(345);
  });

  it('applies a fixed amount coupon', () => {
    const coupon: CouponDefinition = {
      code: 'VERANO25',
      type: 'fixed_amount',
      value: 2500,
      description: '25 €',
      active: true,
    };

    const cart = applyCoupon(buildCart([{ price: 10000, quantity: 1 }]), coupon, NOW);
    const totals = priceCart({ cart, promotions: [], coupons: [coupon], shipping }, NOW_DATE);

    expect(totals.couponDiscount.amount).toBe(2500);
    expect(totals.shipping.amount).toBe(0);
  });

  it('never discounts more than the subtotal', () => {
    const coupon: CouponDefinition = {
      code: 'HUGE',
      type: 'fixed_amount',
      value: 100000,
      description: '1000 €',
      active: true,
    };

    const cart = applyCoupon(buildCart([{ price: 1000, quantity: 1 }]), coupon, NOW);
    const totals = priceCart({ cart, promotions: [], coupons: [coupon], shipping }, NOW_DATE);

    expect(totals.couponDiscount.amount).toBe(1000);
    // The shipping is still charged even when the discount covers the whole subtotal.
    expect(totals.shipping.amount).toBe(499);
    expect(totals.total.amount).toBe(604);
  });

  it('splits the discount across the lines keeping the sum exact', () => {
    const coupon: CouponDefinition = {
      code: 'ODD',
      type: 'fixed_amount',
      value: 1000,
      description: '10 €',
      active: true,
    };

    const cart = applyCoupon(
      buildCart([
        { price: 333, quantity: 1 },
        { price: 333, quantity: 1 },
        { price: 334, quantity: 1 },
      ]),
      coupon,
      NOW,
    );
    const totals = priceCart({ cart, promotions: [], coupons: [coupon], shipping }, NOW_DATE);

    const allocated = totals.items.reduce((acc, item) => acc + item.discount.amount, 0);
    expect(allocated).toBe(1000);
    expect(totals.discountTotal.amount).toBe(1000);
  });

  it('allocates with the largest remainder method', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(10, [5, 5])).toEqual([5, 5]);
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
  });
});
