import { DomainError } from './errors.ts';
import { Money, type CurrencyCode, type MoneyJSON } from './money.ts';

export type CouponKind = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface CouponDefinition {
  readonly code: string;
  readonly description: string;
  readonly kind: CouponKind;
  /** Puntos básicos si kind === 'PERCENTAGE' (ej. 1000 = 10%) */
  readonly percentageBps?: number;
  /** Importe fijo en unidades menores si kind === 'FIXED_AMOUNT' */
  readonly fixedAmountMinor?: number;
  readonly currency?: CurrencyCode;
  readonly minSubtotalMinor?: number;
  readonly maxDiscountMinor?: number;
  readonly active: boolean;
}

export interface DiscountLine {
  readonly code: string;
  readonly description: string;
  readonly amount: Money;
}

export interface PricedLineItem {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPrice: Money;
}

export interface PricingBreakdown {
  readonly subtotal: Money;
  readonly discounts: ReadonlyArray<DiscountLine>;
  readonly discountTotal: Money;
  readonly taxableAmount: Money;
  readonly taxRateBps: number;
  readonly taxAmount: Money;
  readonly shippingAmount: Money;
  readonly grandTotal: Money;
  readonly totalUnits: number;
  readonly distinctSkus: number;
}

export interface PricingBreakdownJSON {
  subtotal: MoneyJSON;
  discounts: Array<{ code: string; description: string; amount: MoneyJSON }>;
  discountTotal: MoneyJSON;
  taxableAmount: MoneyJSON;
  taxRateBps: number;
  taxAmount: MoneyJSON;
  shippingAmount: MoneyJSON;
  grandTotal: MoneyJSON;
  totalUnits: number;
  distinctSkus: number;
}

export interface PricingConfig {
  /** Impuesto aplicable en puntos básicos (ej. 2100 = 21% IVA) */
  readonly taxRateBps: number;
  /** Umbral para envío gratuito en unidades menores */
  readonly freeShippingThresholdMinor: number;
  /** Coste estándar de envío en unidades menores */
  readonly standardShippingMinor: number;
  /** Descuento automático por volumen a partir de N unidades totales */
  readonly bulkDiscountMinUnits: number;
  readonly bulkDiscountBps: number;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  taxRateBps: 2100, // 21% IVA
  freeShippingThresholdMinor: 5000, // Envío gratis desde 50.00
  standardShippingMinor: 499, // 4.99 envío estándar
  bulkDiscountMinUnits: 10, // 5% dto automático por compra en volumen (>= 10 uds)
  bulkDiscountBps: 500,
};

export class PricingEngine {
  private readonly config: PricingConfig;
  private readonly coupons: Map<string, CouponDefinition>;

  constructor(
    coupons: ReadonlyArray<CouponDefinition> = [],
    config: PricingConfig = DEFAULT_PRICING_CONFIG,
  ) {
    this.config = config;
    this.coupons = new Map(coupons.map((c) => [c.code.toUpperCase(), c]));
  }

  registerCoupon(coupon: CouponDefinition): void {
    this.coupons.set(coupon.code.toUpperCase(), coupon);
  }

  getCoupon(code: string): CouponDefinition | undefined {
    return this.coupons.get(code.trim().toUpperCase());
  }

  validateCouponForSubtotal(code: string, subtotal: Money): CouponDefinition {
    const normalized = code.trim().toUpperCase();
    const coupon = this.coupons.get(normalized);
    if (!coupon || !coupon.active) {
      throw new DomainError(
        'COUPON_INVALID',
        `El cupón '${normalized}' no existe o no está activo.`,
        400,
      );
    }
    if (coupon.currency && coupon.currency !== subtotal.currency) {
      throw new DomainError(
        'COUPON_INVALID',
        `El cupón '${normalized}' solo es válido para la moneda ${coupon.currency}.`,
        400,
      );
    }
    if (
      coupon.minSubtotalMinor !== undefined &&
      subtotal.amountMinor < coupon.minSubtotalMinor
    ) {
      const minMoney = Money.ofMinor(coupon.minSubtotalMinor, subtotal.currency);
      throw new DomainError(
        'COUPON_INVALID',
        `El cupón '${normalized}' requiere un subtotal mínimo de ${minMoney.format()}.`,
        400,
      );
    }
    return coupon;
  }

  calculate(
    items: ReadonlyArray<PricedLineItem>,
    currency: CurrencyCode,
    couponCode?: string | null,
  ): PricingBreakdown {
    let subtotal = Money.zero(currency);
    let totalUnits = 0;

    for (const item of items) {
      subtotal = subtotal.add(item.unitPrice.multiply(item.quantity));
      totalUnits += item.quantity;
    }

    if (items.length === 0) {
      const zero = Money.zero(currency);
      return {
        subtotal: zero,
        discounts: [],
        discountTotal: zero,
        taxableAmount: zero,
        taxRateBps: this.config.taxRateBps,
        taxAmount: zero,
        shippingAmount: zero,
        grandTotal: zero,
        totalUnits: 0,
        distinctSkus: 0,
      };
    }

    const discounts: DiscountLine[] = [];
    let remainingBase = subtotal;

    // 1. Regla automática por volumen
    if (totalUnits >= this.config.bulkDiscountMinUnits && this.config.bulkDiscountBps > 0) {
      const bulkAmount = remainingBase.percentageBps(this.config.bulkDiscountBps);
      if (bulkAmount.amountMinor > 0) {
        discounts.push({
          code: 'BULK_AUTO',
          description: `Descuento automático por volumen (${this.config.bulkDiscountMinUnits}+ uds)`,
          amount: bulkAmount,
        });
        remainingBase = remainingBase.subtract(bulkAmount).clampNonNegative();
      }
    }

    // 2. Cupón promocional (si sigue cumpliendo condiciones con el subtotal actual)
    if (couponCode) {
      const coupon = this.coupons.get(couponCode.toUpperCase());
      const meetsMin =
        coupon &&
        coupon.active &&
        (!coupon.currency || coupon.currency === currency) &&
        (coupon.minSubtotalMinor === undefined ||
          subtotal.amountMinor >= coupon.minSubtotalMinor);

      if (coupon && meetsMin) {
        let rawDiscount = Money.zero(currency);
        if (coupon.kind === 'PERCENTAGE' && coupon.percentageBps) {
          rawDiscount = remainingBase.percentageBps(coupon.percentageBps);
        } else if (coupon.kind === 'FIXED_AMOUNT' && coupon.fixedAmountMinor) {
          rawDiscount = Money.ofMinor(coupon.fixedAmountMinor, currency);
        }

        if (
          coupon.maxDiscountMinor !== undefined &&
          rawDiscount.amountMinor > coupon.maxDiscountMinor
        ) {
          rawDiscount = Money.ofMinor(coupon.maxDiscountMinor, currency);
        }

        if (rawDiscount.amountMinor > remainingBase.amountMinor) {
          rawDiscount = remainingBase;
        }

        if (rawDiscount.amountMinor > 0) {
          discounts.push({
            code: coupon.code,
            description: coupon.description,
            amount: rawDiscount,
          });
          remainingBase = remainingBase.subtract(rawDiscount).clampNonNegative();
        }
      }
    }

    const discountTotal = subtotal.subtract(remainingBase);
    const taxableAmount = remainingBase;
    const taxAmount = taxableAmount.percentageBps(this.config.taxRateBps);

    const shippingAmount =
      taxableAmount.amountMinor >= this.config.freeShippingThresholdMinor
        ? Money.zero(currency)
        : Money.ofMinor(this.config.standardShippingMinor, currency);

    const grandTotal = taxableAmount.add(taxAmount).add(shippingAmount);

    return {
      subtotal,
      discounts,
      discountTotal,
      taxableAmount,
      taxRateBps: this.config.taxRateBps,
      taxAmount,
      shippingAmount,
      grandTotal,
      totalUnits,
      distinctSkus: items.length,
    };
  }

  static toJSON(breakdown: PricingBreakdown): PricingBreakdownJSON {
    return {
      subtotal: breakdown.subtotal.toJSON(),
      discounts: breakdown.discounts.map((d) => ({
        code: d.code,
        description: d.description,
        amount: d.amount.toJSON(),
      })),
      discountTotal: breakdown.discountTotal.toJSON(),
      taxableAmount: breakdown.taxableAmount.toJSON(),
      taxRateBps: breakdown.taxRateBps,
      taxAmount: breakdown.taxAmount.toJSON(),
      shippingAmount: breakdown.shippingAmount.toJSON(),
      grandTotal: breakdown.grandTotal.toJSON(),
      totalUnits: breakdown.totalUnits,
      distinctSkus: breakdown.distinctSkus,
    };
  }
}
