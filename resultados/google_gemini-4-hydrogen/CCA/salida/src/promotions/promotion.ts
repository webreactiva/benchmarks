import type { Cart } from '../domain/cart.js';
import type { CartItem } from '../domain/cart-item.js';
import { Money } from '../domain/money.js';

export interface AppliedPromotion {
  promotionId: string;
  name: string;
  couponCode?: string;
  discount: Money;
  lineDiscounts: Record<string, Money>;
  description: string;
}

export interface PromotionEvaluationInput {
  cart: Cart;
  remainingSubtotal: Money;
  now: Date;
}

export interface PromotionEvaluationResult {
  applicable: boolean;
  discount: Money;
  lineDiscounts?: Record<string, Money>;
  description: string;
  reason?: string;
}

export interface PromotionRule {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  readonly stackable: boolean;
  readonly couponCode?: string;
  readonly startsAt?: Date;
  readonly endsAt?: Date;

  isWithinSchedule(now: Date): boolean;
  evaluate(input: PromotionEvaluationInput): PromotionEvaluationResult;
}

export abstract class BasePromotionRule implements PromotionRule {
  public readonly id: string;
  public readonly name: string;
  public readonly priority: number;
  public readonly stackable: boolean;
  public readonly couponCode?: string;
  public readonly startsAt?: Date;
  public readonly endsAt?: Date;

  protected constructor(params: {
    id: string;
    name: string;
    priority?: number;
    stackable?: boolean;
    couponCode?: string;
    startsAt?: Date;
    endsAt?: Date;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.priority = params.priority ?? 100;
    this.stackable = params.stackable ?? true;
    if (params.couponCode !== undefined) {
      this.couponCode = params.couponCode.trim().toUpperCase();
    }
    if (params.startsAt !== undefined) {
      this.startsAt = params.startsAt;
    }
    if (params.endsAt !== undefined) {
      this.endsAt = params.endsAt;
    }
  }

  public isWithinSchedule(now: Date): boolean {
    if (this.startsAt && now.getTime() < this.startsAt.getTime()) return false;
    if (this.endsAt && now.getTime() > this.endsAt.getTime()) return false;
    return true;
  }

  protected matchesItem(
    item: CartItem,
    productIds?: ReadonlyArray<string>,
    categoryIds?: ReadonlyArray<string>,
  ): boolean {
    const productMatch = !productIds || productIds.includes(item.productId);
    const categoryMatch = !categoryIds || categoryIds.includes(item.categoryId);
    return productMatch && categoryMatch;
  }

  public abstract evaluate(input: PromotionEvaluationInput): PromotionEvaluationResult;
}

/**
 * Descuento porcentual sobre el carrito completo o sobre categorías/productos filtrados.
 */
export class PercentageDiscountRule extends BasePromotionRule {
  private readonly percentage: number;
  private readonly minSubtotal?: Money;
  private readonly maxDiscount?: Money;
  private readonly productIds?: ReadonlyArray<string>;
  private readonly categoryIds?: ReadonlyArray<string>;

  constructor(params: {
    id: string;
    name: string;
    percentage: number;
    priority?: number;
    stackable?: boolean;
    couponCode?: string;
    minSubtotal?: Money;
    maxDiscount?: Money;
    productIds?: ReadonlyArray<string>;
    categoryIds?: ReadonlyArray<string>;
    startsAt?: Date;
    endsAt?: Date;
  }) {
    super(params);
    this.percentage = params.percentage;
    if (params.minSubtotal !== undefined) this.minSubtotal = params.minSubtotal;
    if (params.maxDiscount !== undefined) this.maxDiscount = params.maxDiscount;
    if (params.productIds !== undefined) this.productIds = params.productIds;
    if (params.categoryIds !== undefined) this.categoryIds = params.categoryIds;
  }

  public evaluate(input: PromotionEvaluationInput): PromotionEvaluationResult {
    const currency = input.cart.currency;
    if (input.remainingSubtotal.isZero()) {
      return {
        applicable: false,
        discount: Money.zero(currency),
        description: this.name,
        reason: 'El subtotal restante es cero.',
      };
    }

    if (this.minSubtotal) {
      this.minSubtotal.assertSameCurrency(input.remainingSubtotal);
      if (input.cart.subtotal().lessThan(this.minSubtotal)) {
        return {
          applicable: false,
          discount: Money.zero(currency),
          description: this.name,
          reason: `Requiere un subtotal mínimo de ${this.minSubtotal.format()}.`,
        };
      }
    }

    const lineDiscounts: Record<string, Money> = {};
    let eligibleBase = Money.zero(currency);

    for (const item of input.cart.items) {
      if (this.matchesItem(item, this.productIds, this.categoryIds)) {
        eligibleBase = eligibleBase.add(item.subtotal());
      }
    }

    if (eligibleBase.isZero()) {
      return {
        applicable: false,
        discount: Money.zero(currency),
        description: this.name,
        reason: 'No hay artículos elegibles para esta promoción.',
      };
    }

    let rawDiscount = eligibleBase.percentage(this.percentage);
    if (this.maxDiscount) {
      rawDiscount = rawDiscount.min(this.maxDiscount);
    }
    const clampedDiscount = rawDiscount.min(input.remainingSubtotal);

    if (clampedDiscount.isZero()) {
      return {
        applicable: false,
        discount: Money.zero(currency),
        description: this.name,
        reason: 'El descuento calculado es cero.',
      };
    }

    // Distribuimos proporcionalmente por línea elegible
    let distributed = Money.zero(currency);
    const eligibleItems = input.cart.items.filter((item) =>
      this.matchesItem(item, this.productIds, this.categoryIds),
    );
    eligibleItems.forEach((item, index) => {
      if (index === eligibleItems.length - 1) {
        lineDiscounts[item.lineKey] = clampedDiscount.subtractClampedZero(distributed);
      } else {
        const share =
          eligibleBase.amountMinor > 0
            ? Money.fromMinor(
                Math.floor(
                  (clampedDiscount.amountMinor * item.subtotal().amountMinor) /
                    eligibleBase.amountMinor,
                ),
                currency,
              )
            : Money.zero(currency);
        lineDiscounts[item.lineKey] = share;
        distributed = distributed.add(share);
      }
    });

    return {
      applicable: true,
      discount: clampedDiscount,
      lineDiscounts,
      description: `${this.name} (-${this.percentage}%)`,
    };
  }
}

/**
 * Descuento de importe fijo (p. ej. 15 EUR de descuento en compras >= 100 EUR).
 */
export class FixedAmountDiscountRule extends BasePromotionRule {
  private readonly amount: Money;
  private readonly minSubtotal?: Money;

  constructor(params: {
    id: string;
    name: string;
    amount: Money;
    minSubtotal?: Money;
    priority?: number;
    stackable?: boolean;
    couponCode?: string;
    startsAt?: Date;
    endsAt?: Date;
  }) {
    super(params);
    this.amount = params.amount;
    if (params.minSubtotal !== undefined) this.minSubtotal = params.minSubtotal;
  }

  public evaluate(input: PromotionEvaluationInput): PromotionEvaluationResult {
    const currency = input.cart.currency;
    this.amount.assertSameCurrency(input.remainingSubtotal);

    if (input.remainingSubtotal.isZero()) {
      return {
        applicable: false,
        discount: Money.zero(currency),
        description: this.name,
        reason: 'El subtotal restante es cero.',
      };
    }

    if (this.minSubtotal) {
      this.minSubtotal.assertSameCurrency(input.remainingSubtotal);
      if (input.cart.subtotal().lessThan(this.minSubtotal)) {
        return {
          applicable: false,
          discount: Money.zero(currency),
          description: this.name,
          reason: `Requiere un subtotal mínimo de ${this.minSubtotal.format()}.`,
        };
      }
    }

    const discount = this.amount.min(input.remainingSubtotal);
    return {
      applicable: !discount.isZero(),
      discount,
      description: `${this.name} (-${discount.format()})`,
    };
  }
}

/**
 * Promoción tipo 2x1, 3x2 ("Compra X, lleva Y gratis") por cada línea elegible.
 */
export class BuyXGetYRule extends BasePromotionRule {
  private readonly buyQuantity: number;
  private readonly freeQuantity: number;
  private readonly productIds?: ReadonlyArray<string>;
  private readonly categoryIds?: ReadonlyArray<string>;

  constructor(params: {
    id: string;
    name: string;
    buyQuantity: number;
    freeQuantity: number;
    productIds?: ReadonlyArray<string>;
    categoryIds?: ReadonlyArray<string>;
    priority?: number;
    stackable?: boolean;
    couponCode?: string;
    startsAt?: Date;
    endsAt?: Date;
  }) {
    super(params);
    this.buyQuantity = params.buyQuantity;
    this.freeQuantity = params.freeQuantity;
    if (params.productIds !== undefined) this.productIds = params.productIds;
    if (params.categoryIds !== undefined) this.categoryIds = params.categoryIds;
  }

  public evaluate(input: PromotionEvaluationInput): PromotionEvaluationResult {
    const currency = input.cart.currency;
    const bundleSize = this.buyQuantity + this.freeQuantity;
    let totalDiscount = Money.zero(currency);
    const lineDiscounts: Record<string, Money> = {};

    for (const item of input.cart.items) {
      if (!this.matchesItem(item, this.productIds, this.categoryIds)) continue;
      const bundles = Math.floor(item.quantity / bundleSize);
      if (bundles > 0) {
        const freeUnits = bundles * this.freeQuantity;
        const itemDiscount = item.unitPrice.multiply(freeUnits);
        lineDiscounts[item.lineKey] = itemDiscount;
        totalDiscount = totalDiscount.add(itemDiscount);
      }
    }

    const clamped = totalDiscount.min(input.remainingSubtotal);
    if (clamped.isZero()) {
      return {
        applicable: false,
        discount: Money.zero(currency),
        description: this.name,
        reason: `Necesitas al menos ${bundleSize} unidades de un producto elegible.`,
      };
    }

    return {
      applicable: true,
      discount: clamped,
      lineDiscounts,
      description: `${this.name} (${bundleSize}x${this.buyQuantity})`,
    };
  }
}

export interface VolumeTier {
  minQuantity: number;
  percentage: number;
}

/**
 * Descuento escalonado por volumen de unidades (p. ej. >=5 uds -> 10%, >=10 uds -> 20%).
 */
export class TieredVolumeDiscountRule extends BasePromotionRule {
  private readonly tiers: ReadonlyArray<VolumeTier>;
  private readonly productIds?: ReadonlyArray<string>;
  private readonly categoryIds?: ReadonlyArray<string>;

  constructor(params: {
    id: string;
    name: string;
    tiers: ReadonlyArray<VolumeTier>;
    productIds?: ReadonlyArray<string>;
    categoryIds?: ReadonlyArray<string>;
    priority?: number;
    stackable?: boolean;
    couponCode?: string;
    startsAt?: Date;
    endsAt?: Date;
  }) {
    super(params);
    this.tiers = [...params.tiers].sort((a, b) => b.minQuantity - a.minQuantity);
    if (params.productIds !== undefined) this.productIds = params.productIds;
    if (params.categoryIds !== undefined) this.categoryIds = params.categoryIds;
  }

  public evaluate(input: PromotionEvaluationInput): PromotionEvaluationResult {
    const currency = input.cart.currency;
    let eligibleQty = 0;
    let eligibleSubtotal = Money.zero(currency);

    for (const item of input.cart.items) {
      if (this.matchesItem(item, this.productIds, this.categoryIds)) {
        eligibleQty += item.quantity;
        eligibleSubtotal = eligibleSubtotal.add(item.subtotal());
      }
    }

    const matchedTier = this.tiers.find((tier) => eligibleQty >= tier.minQuantity);
    if (!matchedTier || eligibleSubtotal.isZero()) {
      return {
        applicable: false,
        discount: Money.zero(currency),
        description: this.name,
        reason: 'No se alcanzó la cantidad mínima por volumen.',
      };
    }

    const discount = eligibleSubtotal
      .percentage(matchedTier.percentage)
      .min(input.remainingSubtotal);

    return {
      applicable: !discount.isZero(),
      discount,
      description: `${this.name} (${matchedTier.percentage}% por ${eligibleQty} uds.)`,
    };
  }
}

export class PromotionRegistry {
  private readonly rules = new Map<string, PromotionRule>();

  public register(rule: PromotionRule): void {
    this.rules.set(rule.id, rule);
  }

  public unregister(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  public getAll(): PromotionRule[] {
    return Array.from(this.rules.values()).sort((a, b) => a.priority - b.priority);
  }

  public findByCouponCode(code: string): PromotionRule | undefined {
    const normalized = code.trim().toUpperCase();
    for (const rule of this.rules.values()) {
      if (rule.couponCode === normalized) {
        return rule;
      }
    }
    return undefined;
  }

  /**
   * Evalúa promociones automáticas y cupones aplicados al carrito.
   * Si hay promociones no acumulables (stackable=false), selecciona la de mayor beneficio.
   */
  public evaluateCart(cart: Cart, now: Date = new Date()): AppliedPromotion[] {
    const subtotal = cart.subtotal();
    if (subtotal.isZero()) return [];

    const appliedCoupons = new Set(cart.couponCodes);
    const activeRules = this.getAll().filter((rule) => {
      if (!rule.isWithinSchedule(now)) return false;
      if (rule.couponCode) {
        return appliedCoupons.has(rule.couponCode);
      }
      return true;
    });

    const stackableRules = activeRules.filter((r) => r.stackable);
    const exclusiveRules = activeRules.filter((r) => !r.stackable);

    // Evaluamos cuál exclusiva ofrece mayor ahorro sobre el subtotal inicial
    let bestExclusive: { rule: PromotionRule; result: PromotionEvaluationResult } | null = null;
    for (const rule of exclusiveRules) {
      const result = rule.evaluate({ cart, remainingSubtotal: subtotal, now });
      if (result.applicable) {
        if (!bestExclusive || result.discount.greaterThan(bestExclusive.result.discount)) {
          bestExclusive = { rule, result };
        }
      }
    }

    // Evaluamos acumulables secuencialmente para comparar o combinar
    const applied: AppliedPromotion[] = [];
    let remaining = subtotal;

    if (bestExclusive) {
      applied.push({
        promotionId: bestExclusive.rule.id,
        name: bestExclusive.rule.name,
        ...(bestExclusive.rule.couponCode !== undefined
          ? { couponCode: bestExclusive.rule.couponCode }
          : {}),
        discount: bestExclusive.result.discount,
        lineDiscounts: bestExclusive.result.lineDiscounts ?? {},
        description: bestExclusive.result.description,
      });
      remaining = remaining.subtractClampedZero(bestExclusive.result.discount);
    }

    for (const rule of stackableRules) {
      if (remaining.isZero()) break;
      const result = rule.evaluate({ cart, remainingSubtotal: remaining, now });
      if (result.applicable && result.discount.isPositive()) {
        applied.push({
          promotionId: rule.id,
          name: rule.name,
          ...(rule.couponCode !== undefined ? { couponCode: rule.couponCode } : {}),
          discount: result.discount,
          lineDiscounts: result.lineDiscounts ?? {},
          description: result.description,
        });
        remaining = remaining.subtractClampedZero(result.discount);
      }
    }

    return applied;
  }
}
