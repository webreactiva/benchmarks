import type { Cart, CartItemSnapshot } from "./cart.ts";
import { InvalidCouponError } from "./errors.ts";
import { Money, type MoneyJSON } from "./money.ts";

export interface AppliedPromotion {
  readonly ruleId: string;
  readonly description: string;
  readonly couponCode?: string;
  readonly discount: MoneyJSON;
}

export interface PricedLineItem {
  readonly sku: string;
  readonly name: string;
  readonly category: string;
  readonly quantity: number;
  readonly unitPrice: MoneyJSON;
  readonly lineSubtotal: MoneyJSON;
  readonly lineDiscount: MoneyJSON;
  readonly lineTotal: MoneyJSON;
  readonly appliedPromotions: AppliedPromotion[];
}

export interface CartPriceSummary {
  readonly currency: string;
  readonly items: PricedLineItem[];
  readonly subtotal: MoneyJSON;
  readonly lineDiscountTotal: MoneyJSON;
  readonly cartDiscountTotal: MoneyJSON;
  readonly totalDiscount: MoneyJSON;
  readonly taxableAmount: MoneyJSON;
  readonly taxRate: number;
  readonly taxTotal: MoneyJSON;
  readonly shippingTotal: MoneyJSON;
  readonly grandTotal: MoneyJSON;
  readonly appliedPromotions: AppliedPromotion[];
  readonly rejectedCoupons: Array<{ code: string; reason: string }>;
}

export interface PromotionEvaluationContext {
  readonly cart: Cart;
  readonly now: Date;
  readonly items: readonly CartItemSnapshot[];
  readonly lineSubtotals: ReadonlyMap<string, Money>;
  readonly currentLineRemaining: ReadonlyMap<string, Money>;
  readonly currentCartRemaining: Money;
}

export interface PromotionResult {
  readonly lineDiscounts?: Map<string, Money>;
  readonly cartDiscount?: Money;
  readonly freeShipping?: boolean;
}

export interface PromotionRule {
  readonly id: string;
  readonly description: string;
  /** Lower number runs first. */
  readonly priority: number;
  /** If defined, rule only runs when this coupon code is present on the cart. */
  readonly couponCode?: string;
  /** If false, no further non-stackable rules apply after this one triggers. */
  readonly stackable: boolean;
  readonly expiresAt?: Date;
  validateCoupon?(context: PromotionEvaluationContext): string | null;
  evaluate(context: PromotionEvaluationContext): PromotionResult | null;
}

export interface TaxCalculator {
  calculateTax(input: {
    region: string;
    taxableAmount: Money;
  }): { rate: number; tax: Money };
}

export interface ShippingCalculator {
  calculateShipping(input: {
    region: string;
    subtotalAfterDiscounts: Money;
    totalUnits: number;
    freeShippingGranted: boolean;
  }): Money;
}

export class RegionalTaxCalculator implements TaxCalculator {
  private readonly ratesByRegion: Readonly<Record<string, number>>;
  private readonly defaultRate: number;

  constructor(ratesByRegion: Record<string, number> = { ES: 0.21, FR: 0.2, DE: 0.19, US: 0.08 }, defaultRate = 0.21) {
    this.ratesByRegion = { ...ratesByRegion };
    this.defaultRate = defaultRate;
  }

  calculateTax(input: { region: string; taxableAmount: Money }): { rate: number; tax: Money } {
    const rate = this.ratesByRegion[input.region.toUpperCase()] ?? this.defaultRate;
    const tax = input.taxableAmount.multiply(rate);
    return { rate, tax };
  }
}

export class ThresholdShippingCalculator implements ShippingCalculator {
  private readonly flatRateMinor: number;
  private readonly freeShippingThresholdMinor: number;

  constructor(options: { flatRateMinor?: number; freeShippingThresholdMinor?: number } = {}) {
    this.flatRateMinor = options.flatRateMinor ?? 499; // 4.99
    this.freeShippingThresholdMinor = options.freeShippingThresholdMinor ?? 5000; // 50.00
  }

  calculateShipping(input: {
    region: string;
    subtotalAfterDiscounts: Money;
    totalUnits: number;
    freeShippingGranted: boolean;
  }): Money {
    const currency = input.subtotalAfterDiscounts.currency;
    if (input.totalUnits === 0 || input.freeShippingGranted) {
      return Money.zero(currency);
    }
    const threshold = Money.ofMinor(this.freeShippingThresholdMinor, currency);
    if (input.subtotalAfterDiscounts.greaterThanOrEqual(threshold)) {
      return Money.zero(currency);
    }
    return Money.ofMinor(this.flatRateMinor, currency);
  }
}

export class PercentageDiscountRule implements PromotionRule {
  readonly id: string;
  readonly description: string;
  readonly priority: number;
  readonly couponCode?: string;
  readonly stackable: boolean;
  readonly expiresAt?: Date;
  private readonly percent: number;
  private readonly minSubtotalMinor: number;
  private readonly maxDiscountMinor?: number;
  private readonly eligibleCategories?: Set<string>;

  constructor(config: {
    id: string;
    description: string;
    percent: number;
    priority?: number;
    couponCode?: string;
    stackable?: boolean;
    minSubtotalMinor?: number;
    maxDiscountMinor?: number;
    eligibleCategories?: string[];
    expiresAt?: Date;
  }) {
    this.id = config.id;
    this.description = config.description;
    this.percent = config.percent;
    this.priority = config.priority ?? 20;
    this.couponCode = config.couponCode?.trim().toUpperCase();
    this.stackable = config.stackable ?? true;
    this.minSubtotalMinor = config.minSubtotalMinor ?? 0;
    this.maxDiscountMinor = config.maxDiscountMinor;
    this.eligibleCategories = config.eligibleCategories ? new Set(config.eligibleCategories) : undefined;
    this.expiresAt = config.expiresAt;
  }

  validateCoupon(context: PromotionEvaluationContext): string | null {
    if (this.expiresAt && context.now.getTime() > this.expiresAt.getTime()) {
      return "Coupon has expired";
    }
    const min = Money.ofMinor(this.minSubtotalMinor, context.cart.currency);
    if (!context.currentCartRemaining.greaterThanOrEqual(min)) {
      return `Minimum subtotal of ${min.format()} required`;
    }
    return null;
  }

  evaluate(context: PromotionEvaluationContext): PromotionResult | null {
    if (this.validateCoupon(context) !== null) {
      return null;
    }

    const currency = context.cart.currency;
    if (this.eligibleCategories) {
      const lineDiscounts = new Map<string, Money>();
      let accumulated = Money.zero(currency);
      for (const item of context.items) {
        if (!this.eligibleCategories.has(item.category)) continue;
        const remaining = context.currentLineRemaining.get(item.sku) ?? Money.zero(currency);
        let discount = remaining.percentage(this.percent);
        if (this.maxDiscountMinor !== undefined) {
          const cap = Money.ofMinor(this.maxDiscountMinor, currency).subtractClampedZero(accumulated);
          discount = discount.min(cap);
        }
        if (!discount.isZero()) {
          lineDiscounts.set(item.sku, discount);
          accumulated = accumulated.add(discount);
        }
      }
      return lineDiscounts.size > 0 ? { lineDiscounts } : null;
    }

    let discount = context.currentCartRemaining.percentage(this.percent);
    if (this.maxDiscountMinor !== undefined) {
      discount = discount.min(Money.ofMinor(this.maxDiscountMinor, currency));
    }
    return discount.isZero() ? null : { cartDiscount: discount };
  }
}

export class FixedAmountDiscountRule implements PromotionRule {
  readonly id: string;
  readonly description: string;
  readonly priority: number;
  readonly couponCode?: string;
  readonly stackable: boolean;
  readonly expiresAt?: Date;
  private readonly amountMinor: number;
  private readonly currency: string;
  private readonly minSubtotalMinor: number;

  constructor(config: {
    id: string;
    description: string;
    amountMinor: number;
    currency: string;
    priority?: number;
    couponCode?: string;
    stackable?: boolean;
    minSubtotalMinor?: number;
    expiresAt?: Date;
  }) {
    this.id = config.id;
    this.description = config.description;
    this.amountMinor = config.amountMinor;
    this.currency = config.currency.toUpperCase();
    this.priority = config.priority ?? 30;
    this.couponCode = config.couponCode?.trim().toUpperCase();
    this.stackable = config.stackable ?? true;
    this.minSubtotalMinor = config.minSubtotalMinor ?? 0;
    this.expiresAt = config.expiresAt;
  }

  validateCoupon(context: PromotionEvaluationContext): string | null {
    if (context.cart.currency !== this.currency) {
      return `Coupon only valid for currency ${this.currency}`;
    }
    if (this.expiresAt && context.now.getTime() > this.expiresAt.getTime()) {
      return "Coupon has expired";
    }
    const min = Money.ofMinor(this.minSubtotalMinor, this.currency);
    if (!context.currentCartRemaining.greaterThanOrEqual(min)) {
      return `Minimum subtotal of ${min.format()} required`;
    }
    return null;
  }

  evaluate(context: PromotionEvaluationContext): PromotionResult | null {
    if (this.validateCoupon(context) !== null) {
      return null;
    }
    const discount = Money.ofMinor(this.amountMinor, this.currency).min(context.currentCartRemaining);
    return discount.isZero() ? null : { cartDiscount: discount };
  }
}

export class BuyXGetYRule implements PromotionRule {
  readonly id: string;
  readonly description: string;
  readonly priority: number;
  readonly couponCode?: string;
  readonly stackable: boolean;
  readonly expiresAt?: Date;
  private readonly targetSkus?: Set<string>;
  private readonly targetCategories?: Set<string>;
  private readonly buyQuantity: number;
  private readonly freeQuantity: number;

  constructor(config: {
    id: string;
    description: string;
    buyQuantity: number;
    freeQuantity: number;
    targetSkus?: string[];
    targetCategories?: string[];
    priority?: number;
    couponCode?: string;
    stackable?: boolean;
    expiresAt?: Date;
  }) {
    this.id = config.id;
    this.description = config.description;
    this.buyQuantity = config.buyQuantity;
    this.freeQuantity = config.freeQuantity;
    this.targetSkus = config.targetSkus ? new Set(config.targetSkus) : undefined;
    this.targetCategories = config.targetCategories ? new Set(config.targetCategories) : undefined;
    this.priority = config.priority ?? 10;
    this.couponCode = config.couponCode?.trim().toUpperCase();
    this.stackable = config.stackable ?? true;
    this.expiresAt = config.expiresAt;
  }

  evaluate(context: PromotionEvaluationContext): PromotionResult | null {
    if (this.expiresAt && context.now.getTime() > this.expiresAt.getTime()) {
      return null;
    }

    const currency = context.cart.currency;
    const bundleSize = this.buyQuantity + this.freeQuantity;
    const lineDiscounts = new Map<string, Money>();

    for (const item of context.items) {
      const matchesSku = !this.targetSkus || this.targetSkus.has(item.sku);
      const matchesCat = !this.targetCategories || this.targetCategories.has(item.category);
      if (!matchesSku || !matchesCat) continue;

      const eligibleBundles = Math.floor(item.quantity / bundleSize);
      if (eligibleBundles <= 0) continue;

      const freeUnits = eligibleBundles * this.freeQuantity;
      const unitPrice = Money.ofMinor(item.unitPriceMinor, currency);
      const remaining = context.currentLineRemaining.get(item.sku) ?? Money.zero(currency);
      const discount = unitPrice.multiply(freeUnits).min(remaining);
      if (!discount.isZero()) {
        lineDiscounts.set(item.sku, discount);
      }
    }

    return lineDiscounts.size > 0 ? { lineDiscounts } : null;
  }
}

export class BulkTierDiscountRule implements PromotionRule {
  readonly id: string;
  readonly description: string;
  readonly priority: number;
  readonly stackable: boolean;
  private readonly tiers: ReadonlyArray<{ minQuantity: number; percentOff: number }>;
  private readonly eligibleCategories?: Set<string>;

  constructor(config: {
    id: string;
    description: string;
    tiers: Array<{ minQuantity: number; percentOff: number }>;
    eligibleCategories?: string[];
    priority?: number;
    stackable?: boolean;
  }) {
    this.id = config.id;
    this.description = config.description;
    this.tiers = [...config.tiers].sort((a, b) => b.minQuantity - a.minQuantity);
    this.eligibleCategories = config.eligibleCategories ? new Set(config.eligibleCategories) : undefined;
    this.priority = config.priority ?? 15;
    this.stackable = config.stackable ?? true;
  }

  evaluate(context: PromotionEvaluationContext): PromotionResult | null {
    const currency = context.cart.currency;
    const lineDiscounts = new Map<string, Money>();

    for (const item of context.items) {
      if (this.eligibleCategories && !this.eligibleCategories.has(item.category)) continue;
      const matchedTier = this.tiers.find((tier) => item.quantity >= tier.minQuantity);
      if (!matchedTier) continue;

      const remaining = context.currentLineRemaining.get(item.sku) ?? Money.zero(currency);
      const discount = remaining.percentage(matchedTier.percentOff);
      if (!discount.isZero()) {
        lineDiscounts.set(item.sku, discount);
      }
    }

    return lineDiscounts.size > 0 ? { lineDiscounts } : null;
  }
}

export class FreeShippingCouponRule implements PromotionRule {
  readonly id: string;
  readonly description: string;
  readonly priority: number;
  readonly couponCode: string;
  readonly stackable: boolean;
  readonly expiresAt?: Date;

  constructor(config: {
    id: string;
    description: string;
    couponCode: string;
    priority?: number;
    stackable?: boolean;
    expiresAt?: Date;
  }) {
    this.id = config.id;
    this.description = config.description;
    this.couponCode = config.couponCode.trim().toUpperCase();
    this.priority = config.priority ?? 50;
    this.stackable = config.stackable ?? true;
    this.expiresAt = config.expiresAt;
  }

  validateCoupon(context: PromotionEvaluationContext): string | null {
    if (this.expiresAt && context.now.getTime() > this.expiresAt.getTime()) {
      return "Coupon has expired";
    }
    return null;
  }

  evaluate(context: PromotionEvaluationContext): PromotionResult | null {
    if (this.validateCoupon(context) !== null) return null;
    return { freeShipping: true };
  }
}

export class PricingEngine {
  private readonly rules: PromotionRule[];
  private readonly taxCalculator: TaxCalculator;
  private readonly shippingCalculator: ShippingCalculator;

  constructor(options: {
    rules?: PromotionRule[];
    taxCalculator?: TaxCalculator;
    shippingCalculator?: ShippingCalculator;
  } = {}) {
    this.rules = [...(options.rules ?? [])].sort((a, b) => a.priority - b.priority);
    this.taxCalculator = options.taxCalculator ?? new RegionalTaxCalculator();
    this.shippingCalculator = options.shippingCalculator ?? new ThresholdShippingCalculator();
  }

  registerRule(rule: PromotionRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  validateCouponExists(code: string): void {
    const normalized = code.trim().toUpperCase();
    const matched = this.rules.some((rule) => rule.couponCode === normalized);
    if (!matched) {
      throw new InvalidCouponError(normalized, "Unknown coupon code");
    }
  }

  calculate(cart: Cart, now: Date = new Date()): CartPriceSummary {
    const currency = cart.currency;
    const items = cart.items;
    const lineSubtotals = new Map<string, Money>();
    const lineDiscountsAcc = new Map<string, Money>();
    const linePromos = new Map<string, AppliedPromotion[]>();
    const currentLineRemaining = new Map<string, Money>();

    let subtotal = Money.zero(currency);

    for (const item of items) {
      const unitPrice = Money.ofMinor(item.unitPriceMinor, currency);
      const lineSub = unitPrice.multiply(item.quantity);
      lineSubtotals.set(item.sku, lineSub);
      lineDiscountsAcc.set(item.sku, Money.zero(currency));
      linePromos.set(item.sku, []);
      currentLineRemaining.set(item.sku, lineSub);
      subtotal = subtotal.add(lineSub);
    }

    let cartDiscountTotal = Money.zero(currency);
    let lineDiscountTotal = Money.zero(currency);
    let freeShippingGranted = false;
    const appliedPromotions: AppliedPromotion[] = [];
    const rejectedCoupons: Array<{ code: string; reason: string }> = [];

    const appliedCouponSet = new Set(cart.coupons);
    const matchedCoupons = new Set<string>();
    let nonStackableApplied = false;

    for (const rule of this.rules) {
      if (rule.couponCode) {
        if (!appliedCouponSet.has(rule.couponCode)) {
          continue;
        }
        matchedCoupons.add(rule.couponCode);
      }

      if (nonStackableApplied && !rule.stackable) {
        if (rule.couponCode) {
          rejectedCoupons.push({
            code: rule.couponCode,
            reason: "Cannot be combined with another non-stackable promotion",
          });
        }
        continue;
      }

      const currentCartRemaining = subtotal
        .subtractClampedZero(lineDiscountTotal)
        .subtractClampedZero(cartDiscountTotal);

      const context: PromotionEvaluationContext = {
        cart,
        now,
        items,
        lineSubtotals,
        currentLineRemaining,
        currentCartRemaining,
      };

      if (rule.couponCode && rule.validateCoupon) {
        const validationError = rule.validateCoupon(context);
        if (validationError) {
          rejectedCoupons.push({ code: rule.couponCode, reason: validationError });
          continue;
        }
      }

      const result = rule.evaluate(context);
      if (!result) continue;

      let ruleTotalDiscount = Money.zero(currency);

      if (result.lineDiscounts) {
        for (const [sku, rawDiscount] of result.lineDiscounts.entries()) {
          const remaining = currentLineRemaining.get(sku);
          if (!remaining || rawDiscount.isZero()) continue;
          const clamped = rawDiscount.min(remaining);
          if (clamped.isZero()) continue;

          currentLineRemaining.set(sku, remaining.subtract(clamped));
          const prevAcc = lineDiscountsAcc.get(sku) ?? Money.zero(currency);
          lineDiscountsAcc.set(sku, prevAcc.add(clamped));
          lineDiscountTotal = lineDiscountTotal.add(clamped);
          ruleTotalDiscount = ruleTotalDiscount.add(clamped);

          linePromos.get(sku)?.push({
            ruleId: rule.id,
            description: rule.description,
            couponCode: rule.couponCode,
            discount: clamped.toJSON(),
          });
        }
      }

      if (result.cartDiscount && !result.cartDiscount.isZero()) {
        const remainingCart = subtotal
          .subtractClampedZero(lineDiscountTotal)
          .subtractClampedZero(cartDiscountTotal);
        const clampedCartDiscount = result.cartDiscount.min(remainingCart);
        if (!clampedCartDiscount.isZero()) {
          cartDiscountTotal = cartDiscountTotal.add(clampedCartDiscount);
          ruleTotalDiscount = ruleTotalDiscount.add(clampedCartDiscount);
        }
      }

      if (result.freeShipping) {
        freeShippingGranted = true;
      }

      if (!ruleTotalDiscount.isZero() || result.freeShipping) {
        appliedPromotions.push({
          ruleId: rule.id,
          description: rule.description,
          couponCode: rule.couponCode,
          discount: ruleTotalDiscount.toJSON(),
        });
        if (!rule.stackable) {
          nonStackableApplied = true;
        }
      }
    }

    for (const coupon of cart.coupons) {
      if (!matchedCoupons.has(coupon)) {
        rejectedCoupons.push({ code: coupon, reason: "Unknown coupon code" });
      }
    }

    const totalDiscount = lineDiscountTotal.add(cartDiscountTotal);
    const subtotalAfterLineDiscounts = subtotal.subtractClampedZero(lineDiscountTotal);
    const subtotalAfterAllDiscounts = subtotal.subtractClampedZero(totalDiscount);

    // Proportionally allocate cart-level discounts across taxable vs tax-exempt lines
    let taxableAfterLine = Money.zero(currency);
    for (const item of items) {
      if (item.taxExempt) continue;
      taxableAfterLine = taxableAfterLine.add(currentLineRemaining.get(item.sku) ?? Money.zero(currency));
    }

    let taxableAmount = taxableAfterLine;
    if (!subtotalAfterLineDiscounts.isZero() && !cartDiscountTotal.isZero()) {
      const taxableRatio = taxableAfterLine.amountMinor / subtotalAfterLineDiscounts.amountMinor;
      const taxableCartDiscount = cartDiscountTotal.multiply(taxableRatio);
      taxableAmount = taxableAfterLine.subtractClampedZero(taxableCartDiscount);
    }

    const { rate: taxRate, tax: taxTotal } = this.taxCalculator.calculateTax({
      region: cart.shippingRegion,
      taxableAmount,
    });

    const shippingTotal = this.shippingCalculator.calculateShipping({
      region: cart.shippingRegion,
      subtotalAfterDiscounts: subtotalAfterAllDiscounts,
      totalUnits: cart.totalItemUnits,
      freeShippingGranted,
    });

    const grandTotal = subtotalAfterAllDiscounts.add(taxTotal).add(shippingTotal);

    const pricedItems: PricedLineItem[] = items.map((item) => {
      const unitPrice = Money.ofMinor(item.unitPriceMinor, currency);
      const lineSub = lineSubtotals.get(item.sku) ?? Money.zero(currency);
      const lineDisc = lineDiscountsAcc.get(item.sku) ?? Money.zero(currency);
      const lineTot = lineSub.subtractClampedZero(lineDisc);

      return {
        sku: item.sku,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unitPrice: unitPrice.toJSON(),
        lineSubtotal: lineSub.toJSON(),
        lineDiscount: lineDisc.toJSON(),
        lineTotal: lineTot.toJSON(),
        appliedPromotions: linePromos.get(item.sku) ?? [],
      };
    });

    return {
      currency,
      items: pricedItems,
      subtotal: subtotal.toJSON(),
      lineDiscountTotal: lineDiscountTotal.toJSON(),
      cartDiscountTotal: cartDiscountTotal.toJSON(),
      totalDiscount: totalDiscount.toJSON(),
      taxableAmount: taxableAmount.toJSON(),
      taxRate,
      taxTotal: taxTotal.toJSON(),
      shippingTotal: shippingTotal.toJSON(),
      grandTotal: grandTotal.toJSON(),
      appliedPromotions,
      rejectedCoupons,
    };
  }
}
