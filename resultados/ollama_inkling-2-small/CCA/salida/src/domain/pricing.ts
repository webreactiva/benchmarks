import type { CartItem } from "./cart.js";
import type { Coupon } from "./catalog.js";
import { CouponInvalidError } from "./errors.js";

export interface PricingConfig {
  /** VAT/sales-tax rate, e.g. 0.21 for 21%. */
  taxRate: number;
  shippingFlatCents: number;
  /** Subtotal (after discount) at or above which shipping is free. */
  freeShippingThresholdCents: number;
  currency: string;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  taxRate: 0.21,
  shippingFlatCents: 499,
  freeShippingThresholdCents: 10000,
  currency: "EUR",
};

export interface Totals {
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
}

export function assertCouponUsable(coupon: Coupon, subtotalCents: number, now: Date = new Date()): void {
  if (coupon.expiresAt !== undefined && new Date(coupon.expiresAt).getTime() <= now.getTime()) {
    throw new CouponInvalidError(coupon.code, "expired");
  }
  if (coupon.minSubtotalCents !== undefined && subtotalCents < coupon.minSubtotalCents) {
    throw new CouponInvalidError(
      coupon.code,
      `requires a subtotal of at least ${coupon.minSubtotalCents} cents`,
    );
  }
}

export function computeDiscountCents(coupon: Coupon, subtotalCents: number): number {
  let discount =
    coupon.type === "percentage"
      ? Math.round((subtotalCents * coupon.value) / 100)
      : Math.min(coupon.value, subtotalCents);
  if (coupon.maxDiscountCents !== undefined) {
    discount = Math.min(discount, coupon.maxDiscountCents);
  }
  return Math.max(0, Math.min(discount, subtotalCents));
}

export function computeTotals(
  items: readonly CartItem[],
  coupon: Coupon | null,
  config: PricingConfig,
  now: Date = new Date(),
): Totals {
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

  let discountCents = 0;
  if (coupon !== null && subtotalCents > 0) {
    assertCouponUsable(coupon, subtotalCents, now);
    discountCents = computeDiscountCents(coupon, subtotalCents);
  }

  const discountedBase = subtotalCents - discountCents;
  const taxCents = Math.round(discountedBase * config.taxRate);
  const shippingCents =
    items.length === 0 || discountedBase >= config.freeShippingThresholdCents
      ? 0
      : config.shippingFlatCents;

  return {
    currency: config.currency,
    subtotalCents,
    discountCents,
    taxCents,
    shippingCents,
    totalCents: discountedBase + taxCents + shippingCents,
  };
}
