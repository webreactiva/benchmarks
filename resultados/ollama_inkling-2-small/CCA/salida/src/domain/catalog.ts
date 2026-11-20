export interface Product {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
}

export type CouponType = "percentage" | "fixed";

export interface Coupon {
  code: string;
  type: CouponType;
  /** Percentage (0-100) for "percentage" coupons, cents for "fixed" coupons. */
  value: number;
  minSubtotalCents?: number;
  maxDiscountCents?: number;
  description?: string;
  /** ISO-8601 date; the coupon is invalid after this instant. */
  expiresAt?: string;
}
