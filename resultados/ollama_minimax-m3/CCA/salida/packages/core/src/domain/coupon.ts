import type { Money } from './money.js';
import type { DomainErrorCode } from './errors.js';

export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';

export interface AppliedCoupon {
  readonly code: string;
  readonly type: DiscountType;
  readonly value: number;
  readonly description: string;
  readonly appliedAt: string;
  readonly discountAmount: Money;
}

/**
 * A coupon that has been *validated* against the cart. Definition objects come
 * from the pricing rules provider, the resolved ones carry the actual money.
 */
export interface CouponDefinition {
  readonly code: string;
  readonly type: DiscountType;
  /** percentage: 0.1 == 10%. fixed_amount: amount in minor units. */
  readonly value: number;
  readonly description: string;
  readonly minSubtotal?: Money;
  readonly maxDiscount?: Money;
  readonly expiresAt?: string;
  readonly active: boolean;
}

export interface Promotion {
  readonly id: string;
  readonly type: DiscountType;
  readonly value: number;
  readonly description: string;
  readonly minSubtotal?: Money;
  readonly maxDiscount?: Money;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly priority: number;
}

export interface ShippingPolicy {
  readonly flatAmount: Money;
  readonly freeAbove?: Money;
  readonly taxRate: number;
}

export interface CouponRejection {
  readonly code: DomainErrorCode;
  readonly reason: string;
}
