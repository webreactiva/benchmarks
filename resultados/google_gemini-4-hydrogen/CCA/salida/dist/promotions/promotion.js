import { Money } from '../domain/money.js';
export class BasePromotionRule {
    id;
    name;
    priority;
    stackable;
    couponCode;
    startsAt;
    endsAt;
    constructor(params) {
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
    isWithinSchedule(now) {
        if (this.startsAt && now.getTime() < this.startsAt.getTime())
            return false;
        if (this.endsAt && now.getTime() > this.endsAt.getTime())
            return false;
        return true;
    }
    matchesItem(item, productIds, categoryIds) {
        const productMatch = !productIds || productIds.includes(item.productId);
        const categoryMatch = !categoryIds || categoryIds.includes(item.categoryId);
        return productMatch && categoryMatch;
    }
}
/**
 * Descuento porcentual sobre el carrito completo o sobre categorías/productos filtrados.
 */
export class PercentageDiscountRule extends BasePromotionRule {
    percentage;
    minSubtotal;
    maxDiscount;
    productIds;
    categoryIds;
    constructor(params) {
        super(params);
        this.percentage = params.percentage;
        if (params.minSubtotal !== undefined)
            this.minSubtotal = params.minSubtotal;
        if (params.maxDiscount !== undefined)
            this.maxDiscount = params.maxDiscount;
        if (params.productIds !== undefined)
            this.productIds = params.productIds;
        if (params.categoryIds !== undefined)
            this.categoryIds = params.categoryIds;
    }
    evaluate(input) {
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
        const lineDiscounts = {};
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
        const eligibleItems = input.cart.items.filter((item) => this.matchesItem(item, this.productIds, this.categoryIds));
        eligibleItems.forEach((item, index) => {
            if (index === eligibleItems.length - 1) {
                lineDiscounts[item.lineKey] = clampedDiscount.subtractClampedZero(distributed);
            }
            else {
                const share = eligibleBase.amountMinor > 0
                    ? Money.fromMinor(Math.floor((clampedDiscount.amountMinor * item.subtotal().amountMinor) /
                        eligibleBase.amountMinor), currency)
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
    amount;
    minSubtotal;
    constructor(params) {
        super(params);
        this.amount = params.amount;
        if (params.minSubtotal !== undefined)
            this.minSubtotal = params.minSubtotal;
    }
    evaluate(input) {
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
    buyQuantity;
    freeQuantity;
    productIds;
    categoryIds;
    constructor(params) {
        super(params);
        this.buyQuantity = params.buyQuantity;
        this.freeQuantity = params.freeQuantity;
        if (params.productIds !== undefined)
            this.productIds = params.productIds;
        if (params.categoryIds !== undefined)
            this.categoryIds = params.categoryIds;
    }
    evaluate(input) {
        const currency = input.cart.currency;
        const bundleSize = this.buyQuantity + this.freeQuantity;
        let totalDiscount = Money.zero(currency);
        const lineDiscounts = {};
        for (const item of input.cart.items) {
            if (!this.matchesItem(item, this.productIds, this.categoryIds))
                continue;
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
/**
 * Descuento escalonado por volumen de unidades (p. ej. >=5 uds -> 10%, >=10 uds -> 20%).
 */
export class TieredVolumeDiscountRule extends BasePromotionRule {
    tiers;
    productIds;
    categoryIds;
    constructor(params) {
        super(params);
        this.tiers = [...params.tiers].sort((a, b) => b.minQuantity - a.minQuantity);
        if (params.productIds !== undefined)
            this.productIds = params.productIds;
        if (params.categoryIds !== undefined)
            this.categoryIds = params.categoryIds;
    }
    evaluate(input) {
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
    rules = new Map();
    register(rule) {
        this.rules.set(rule.id, rule);
    }
    unregister(ruleId) {
        return this.rules.delete(ruleId);
    }
    getAll() {
        return Array.from(this.rules.values()).sort((a, b) => a.priority - b.priority);
    }
    findByCouponCode(code) {
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
    evaluateCart(cart, now = new Date()) {
        const subtotal = cart.subtotal();
        if (subtotal.isZero())
            return [];
        const appliedCoupons = new Set(cart.couponCodes);
        const activeRules = this.getAll().filter((rule) => {
            if (!rule.isWithinSchedule(now))
                return false;
            if (rule.couponCode) {
                return appliedCoupons.has(rule.couponCode);
            }
            return true;
        });
        const stackableRules = activeRules.filter((r) => r.stackable);
        const exclusiveRules = activeRules.filter((r) => !r.stackable);
        // Evaluamos cuál exclusiva ofrece mayor ahorro sobre el subtotal inicial
        let bestExclusive = null;
        for (const rule of exclusiveRules) {
            const result = rule.evaluate({ cart, remainingSubtotal: subtotal, now });
            if (result.applicable) {
                if (!bestExclusive || result.discount.greaterThan(bestExclusive.result.discount)) {
                    bestExclusive = { rule, result };
                }
            }
        }
        // Evaluamos acumulables secuencialmente para comparar o combinar
        const applied = [];
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
            if (remaining.isZero())
                break;
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
//# sourceMappingURL=promotion.js.map