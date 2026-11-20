import { describe, expect, it } from "vitest";
import { computeTotals, DEFAULT_PRICING_CONFIG } from "../src/domain/pricing.js";
import { CouponInvalidError } from "../src/domain/errors.js";
import type { Coupon } from "../src/domain/catalog.js";
import type { CartItem } from "../src/domain/cart.js";

const config = { ...DEFAULT_PRICING_CONFIG, taxRate: 0.21, shippingFlatCents: 499, freeShippingThresholdCents: 10000 };

const item = (unitPriceCents: number, quantity: number): CartItem => ({
  productId: `p-${unitPriceCents}`,
  name: "test",
  unitPriceCents,
  quantity,
});

describe("computeTotals", () => {
  it("returns zeroed totals for an empty cart and no shipping", () => {
    const totals = computeTotals([], null, config);
    expect(totals.subtotalCents).toBe(0);
    expect(totals.totalCents).toBe(0);
    expect(totals.shippingCents).toBe(0);
  });

  it("computes subtotal, tax and shipping below the free-shipping threshold", () => {
    const totals = computeTotals([item(1000, 2)], null, config);
    expect(totals.subtotalCents).toBe(2000);
    expect(totals.taxCents).toBe(420); // 21% of 2000
    expect(totals.shippingCents).toBe(499);
    expect(totals.totalCents).toBe(2000 + 420 + 499);
  });

  it("applies free shipping at the threshold", () => {
    const totals = computeTotals([item(10000, 1)], null, config);
    expect(totals.shippingCents).toBe(0);
  });

  it("applies a percentage coupon before tax", () => {
    const coupon: Coupon = { code: "PCT10", type: "percentage", value: 10 };
    const totals = computeTotals([item(10000, 1)], coupon, config);
    expect(totals.discountCents).toBe(1000);
    expect(totals.taxCents).toBe(Math.round(9000 * 0.21));
    // 9000€-cents base is below the 10000 free-shipping threshold
    expect(totals.shippingCents).toBe(499);
    expect(totals.totalCents).toBe(9000 + 1890 + 499);
  });

  it("caps percentage discount at maxDiscountCents", () => {
    const coupon: Coupon = { code: "PCT50", type: "percentage", value: 50, maxDiscountCents: 1000 };
    const totals = computeTotals([item(10000, 1)], coupon, config);
    expect(totals.discountCents).toBe(1000);
  });

  it("applies a fixed coupon capped at subtotal", () => {
    const coupon: Coupon = { code: "FIX", type: "fixed", value: 5000 };
    expect(computeTotals([item(3000, 1)], coupon, config).discountCents).toBe(3000);
  });

  it("rejects a coupon below its minimum subtotal", () => {
    const coupon: Coupon = { code: "BIG", type: "fixed", value: 1000, minSubtotalCents: 20000 };
    expect(() => computeTotals([item(1000, 1)], coupon, config)).toThrow(CouponInvalidError);
  });

  it("rejects an expired coupon", () => {
    const coupon: Coupon = { code: "OLD", type: "percentage", value: 10, expiresAt: "2000-01-01T00:00:00.000Z" };
    expect(() => computeTotals([item(1000, 1)], coupon, config)).toThrow(CouponInvalidError);
  });
});
