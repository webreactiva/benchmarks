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
export declare abstract class BasePromotionRule implements PromotionRule {
    readonly id: string;
    readonly name: string;
    readonly priority: number;
    readonly stackable: boolean;
    readonly couponCode?: string;
    readonly startsAt?: Date;
    readonly endsAt?: Date;
    protected constructor(params: {
        id: string;
        name: string;
        priority?: number;
        stackable?: boolean;
        couponCode?: string;
        startsAt?: Date;
        endsAt?: Date;
    });
    isWithinSchedule(now: Date): boolean;
    protected matchesItem(item: CartItem, productIds?: ReadonlyArray<string>, categoryIds?: ReadonlyArray<string>): boolean;
    abstract evaluate(input: PromotionEvaluationInput): PromotionEvaluationResult;
}
/**
 * Descuento porcentual sobre el carrito completo o sobre categorías/productos filtrados.
 */
export declare class PercentageDiscountRule extends BasePromotionRule {
    private readonly percentage;
    private readonly minSubtotal?;
    private readonly maxDiscount?;
    private readonly productIds?;
    private readonly categoryIds?;
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
    });
    evaluate(input: PromotionEvaluationInput): PromotionEvaluationResult;
}
/**
 * Descuento de importe fijo (p. ej. 15 EUR de descuento en compras >= 100 EUR).
 */
export declare class FixedAmountDiscountRule extends BasePromotionRule {
    private readonly amount;
    private readonly minSubtotal?;
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
    });
    evaluate(input: PromotionEvaluationInput): PromotionEvaluationResult;
}
/**
 * Promoción tipo 2x1, 3x2 ("Compra X, lleva Y gratis") por cada línea elegible.
 */
export declare class BuyXGetYRule extends BasePromotionRule {
    private readonly buyQuantity;
    private readonly freeQuantity;
    private readonly productIds?;
    private readonly categoryIds?;
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
    });
    evaluate(input: PromotionEvaluationInput): PromotionEvaluationResult;
}
export interface VolumeTier {
    minQuantity: number;
    percentage: number;
}
/**
 * Descuento escalonado por volumen de unidades (p. ej. >=5 uds -> 10%, >=10 uds -> 20%).
 */
export declare class TieredVolumeDiscountRule extends BasePromotionRule {
    private readonly tiers;
    private readonly productIds?;
    private readonly categoryIds?;
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
    });
    evaluate(input: PromotionEvaluationInput): PromotionEvaluationResult;
}
export declare class PromotionRegistry {
    private readonly rules;
    register(rule: PromotionRule): void;
    unregister(ruleId: string): boolean;
    getAll(): PromotionRule[];
    findByCouponCode(code: string): PromotionRule | undefined;
    /**
     * Evalúa promociones automáticas y cupones aplicados al carrito.
     * Si hay promociones no acumulables (stackable=false), selecciona la de mayor beneficio.
     */
    evaluateCart(cart: Cart, now?: Date): AppliedPromotion[];
}
//# sourceMappingURL=promotion.d.ts.map