import type { Money } from '../domain/money.js';
import { applyRate, money, multiply, zero } from '../domain/money.js';
import type {
  AppliedCoupon,
  CouponDefinition,
  DiscountType,
  Promotion,
  ShippingPolicy,
} from '../domain/coupon.js';
import type { Cart, CartLine } from '../domain/cart.js';

export interface PricingInput {
  readonly cart: Cart;
  readonly promotions: readonly Promotion[];
  readonly coupons: readonly CouponDefinition[];
  readonly shipping: ShippingPolicy;
}

export interface LinePricing {
  readonly lineId: string;
  readonly productId: string;
  readonly sku: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly subtotal: Money;
  readonly discount: Money;
  readonly total: Money;
}

export interface CartTotals {
  readonly currency: string;
  readonly subtotal: Money;
  readonly promotionDiscount: Money;
  readonly couponDiscount: Money;
  readonly discountTotal: Money;
  readonly shipping: Money;
  readonly freeShipping: boolean;
  readonly taxableBase: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly unitCount: number;
  readonly distinctItems: number;
  readonly items: readonly LinePricing[];
  readonly appliedCoupons: readonly AppliedCoupon[];
  readonly appliedPromotions: readonly Promotion[];
}

/** A rule that can produce a discount on the cart subtotal. */
interface DiscountRule {
  readonly type: DiscountType;
  readonly value: number;
  readonly maxDiscount?: Money;
  readonly minSubtotal?: Money;
}

interface DiscountOutcome {
  readonly amount: number;
  readonly freeShipping: boolean;
}

function computeDiscount(base: number, rule: DiscountRule): DiscountOutcome {
  // The minimum subtotal applies to every kind of rule, free shipping included.
  if (rule.minSubtotal && base < rule.minSubtotal.amount) {
    return { amount: 0, freeShipping: false };
  }
  if (rule.type === 'free_shipping') {
    return { amount: 0, freeShipping: true };
  }
  let amount = 0;
  if (rule.type === 'percentage') {
    amount = Math.round(base * rule.value);
  } else {
    amount = rule.value;
  }
  if (rule.maxDiscount) {
    amount = Math.min(amount, rule.maxDiscount.amount);
  }
  amount = Math.min(amount, base);
  if (amount < 0) amount = 0;
  return { amount, freeShipping: false };
}

/**
 * Splits `total` across `weights` using the largest remainder method, so the
 * sum of the parts is always exactly `total` (no lost cents).
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (total <= 0 || sum <= 0 || weights.length === 0) {
    return weights.map(() => 0);
  }
  const raw = weights.map((weight) => (total * weight) / sum);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = total - floors.reduce((acc, value) => acc + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const result = [...floors];
  for (const entry of order) {
    if (remainder <= 0) break;
    const current = result[entry.index] ?? 0;
    result[entry.index] = current + 1;
    remainder -= 1;
  }
  return result;
}

function isRuleActive(rule: { startsAt?: string; endsAt?: string }, now: Date): boolean {
  if (rule.startsAt && new Date(rule.startsAt) > now) return false;
  if (rule.endsAt && new Date(rule.endsAt) < now) return false;
  return true;
}

/**
 * Pure pricing engine: cart + promotions + coupons + shipping + tax => totals.
 *
 * Order of application (industry standard):
 *   subtotal -> automatic promotions -> coupons -> shipping -> tax -> total
 */
export function priceCart(input: PricingInput, now: Date = new Date()): CartTotals {
  const { cart, shipping } = input;
  const currency = cart.currency;

  const lineSubtotals: number[] = cart.lines.map((line) => line.unitPrice.amount * line.quantity);
  const subtotalAmount = lineSubtotals.reduce((acc, value) => acc + value, 0);
  const subtotal = money(subtotalAmount, currency);

  const promotions = [...input.promotions]
    .filter((promotion) => isRuleActive(promotion, now))
    .sort((a, b) => a.priority - b.priority);

  let base = subtotalAmount;
  let promotionDiscountAmount = 0;
  let freeShipping = false;

  for (const promotion of promotions) {
    const outcome = computeDiscount(base, {
      type: promotion.type,
      value: promotion.value,
      ...(promotion.maxDiscount ? { maxDiscount: promotion.maxDiscount } : {}),
      ...(promotion.minSubtotal ? { minSubtotal: promotion.minSubtotal } : {}),
    });
    base -= outcome.amount;
    promotionDiscountAmount += outcome.amount;
    freeShipping = freeShipping || outcome.freeShipping;
  }

  const couponDefinitions = new Map<string, CouponDefinition>(
    input.coupons.map((coupon) => [coupon.code.toUpperCase(), coupon]),
  );

  const appliedCoupons: AppliedCoupon[] = [];
  let couponDiscountAmount = 0;

  for (const applied of cart.coupons) {
    const definition = couponDefinitions.get(applied.code.toUpperCase());
    if (!definition || !definition.active) continue;
    const outcome = computeDiscount(base, {
      type: definition.type,
      value: definition.value,
      ...(definition.maxDiscount ? { maxDiscount: definition.maxDiscount } : {}),
      ...(definition.minSubtotal ? { minSubtotal: definition.minSubtotal } : {}),
    });
    base -= outcome.amount;
    couponDiscountAmount += outcome.amount;
    freeShipping = freeShipping || outcome.freeShipping;
    appliedCoupons.push({ ...applied, discountAmount: money(outcome.amount, currency) });
  }

  const discountTotalAmount = promotionDiscountAmount + couponDiscountAmount;

  // Shipping: flat rate, free above a threshold or with a free-shipping coupon.
  // An empty cart is never charged for the shipping.
  const isEmpty = cart.lines.length === 0;
  let shippingAmount = isEmpty ? 0 : shipping.flatAmount.amount;
  const qualifiesForFreeShipping =
    !isEmpty &&
    ((shipping.freeAbove && subtotalAmount >= shipping.freeAbove.amount) || freeShipping);
  if (qualifiesForFreeShipping) shippingAmount = 0;

  const taxableBaseAmount = Math.max(0, subtotalAmount - discountTotalAmount) + shippingAmount;
  const taxableBase = money(taxableBaseAmount, currency);
  const tax = applyRate(taxableBase, shipping.taxRate);
  const total = money(taxableBaseAmount + tax.amount, currency);

  // Spread the total discount across the lines proportionally to their value.
  const lineDiscounts = allocate(discountTotalAmount, lineSubtotals);

  const items: LinePricing[] = cart.lines.map((line: CartLine, index: number) => {
    const lineSubtotalAmount = lineSubtotals[index] ?? 0;
    const discountAmount = lineDiscounts[index] ?? 0;
    return {
      lineId: line.id,
      productId: line.productId,
      sku: line.sku,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotal: money(lineSubtotalAmount, currency),
      discount: money(discountAmount, currency),
      total: money(lineSubtotalAmount - discountAmount, currency),
    };
  });

  return {
    currency,
    subtotal,
    promotionDiscount: money(promotionDiscountAmount, currency),
    couponDiscount: money(couponDiscountAmount, currency),
    discountTotal: money(discountTotalAmount, currency),
    shipping: money(shippingAmount, currency),
    freeShipping: qualifiesForFreeShipping,
    taxableBase,
    tax,
    total,
    unitCount: cart.lines.reduce((acc, line) => acc + line.quantity, 0),
    distinctItems: cart.lines.length,
    items,
    appliedCoupons,
    appliedPromotions: promotions,
  };
}

export function emptyTotals(currency: string): CartTotals {
  return {
    currency,
    subtotal: zero(currency),
    promotionDiscount: zero(currency),
    couponDiscount: zero(currency),
    discountTotal: zero(currency),
    shipping: zero(currency),
    freeShipping: false,
    taxableBase: zero(currency),
    tax: zero(currency),
    total: zero(currency),
    unitCount: 0,
    distinctItems: 0,
    items: [],
    appliedCoupons: [],
    appliedPromotions: [],
  };
}

export function lineTotal(line: CartLine): Money {
  return multiply(line.unitPrice, line.quantity);
}
