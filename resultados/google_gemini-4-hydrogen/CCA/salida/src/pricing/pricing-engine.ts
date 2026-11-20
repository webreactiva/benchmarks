import type { Cart } from '../domain/cart.js';
import { Money } from '../domain/money.js';
import type { AppliedPromotion, PromotionRegistry } from '../promotions/promotion.js';
import type { ShippingQuote, ShippingStrategy } from './shipping-strategy.js';
import type { TaxCalculationResult, TaxStrategy } from './tax-strategy.js';

export interface PricedLineItem {
  lineKey: string;
  productId: string;
  variantId?: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  grossSubtotal: Money;
  discount: Money;
  netSubtotal: Money;
}

export interface CartPricingSummary {
  cartId: string;
  currency: string;
  version: number;
  lines: PricedLineItem[];
  grossSubtotal: Money;
  totalDiscount: Money;
  netSubtotal: Money;
  appliedPromotions: AppliedPromotion[];
  tax: TaxCalculationResult;
  shipping: ShippingQuote;
  grandTotal: Money;
}

/**
 * Orquesta el pipeline determinista de precios:
 * Subtotal bruto -> Promociones/Descuentos -> Prorrateo por línea -> Impuestos -> Envío -> Total final.
 */
export class PricingEngine {
  private readonly promotionRegistry: PromotionRegistry;
  private readonly taxStrategy: TaxStrategy;
  private readonly shippingStrategy: ShippingStrategy;

  constructor(params: {
    promotionRegistry: PromotionRegistry;
    taxStrategy: TaxStrategy;
    shippingStrategy: ShippingStrategy;
  }) {
    this.promotionRegistry = params.promotionRegistry;
    this.taxStrategy = params.taxStrategy;
    this.shippingStrategy = params.shippingStrategy;
  }

  public calculate(cart: Cart, now: Date = new Date()): CartPricingSummary {
    const currency = cart.currency;
    const grossSubtotal = cart.subtotal();
    const appliedPromotions = this.promotionRegistry.evaluateCart(cart, now);

    let totalDiscount = Money.zero(currency);
    const lineDiscountsAcc = new Map<string, Money>();

    for (const promo of appliedPromotions) {
      totalDiscount = totalDiscount.add(promo.discount);

      // Si la promoción especifica descuentos por línea, los acumulamos;
      // si es global (ej. FixedAmountDiscountRule), prorrateamos por subtotal de línea.
      const hasExplicitLines = Object.keys(promo.lineDiscounts).length > 0;
      if (hasExplicitLines) {
        for (const [lineKey, amount] of Object.entries(promo.lineDiscounts)) {
          const prev = lineDiscountsAcc.get(lineKey) ?? Money.zero(currency);
          lineDiscountsAcc.set(lineKey, prev.add(amount));
        }
      } else if (grossSubtotal.isPositive()) {
        let distributed = Money.zero(currency);
        const items = cart.items;
        items.forEach((item, index) => {
          const share =
            index === items.length - 1
              ? promo.discount.subtractClampedZero(distributed)
              : Money.fromMinor(
                  Math.floor(
                    (promo.discount.amountMinor * item.subtotal().amountMinor) /
                      grossSubtotal.amountMinor,
                  ),
                  currency,
                );
          const prev = lineDiscountsAcc.get(item.lineKey) ?? Money.zero(currency);
          lineDiscountsAcc.set(item.lineKey, prev.add(share));
          distributed = distributed.add(share);
        });
      }
    }

    totalDiscount = totalDiscount.min(grossSubtotal);
    const netSubtotal = grossSubtotal.subtractClampedZero(totalDiscount);

    const discountedLineTotals = new Map<string, Money>();
    const lines: PricedLineItem[] = cart.items.map((item) => {
      const gross = item.subtotal();
      const rawDiscount = lineDiscountsAcc.get(item.lineKey) ?? Money.zero(currency);
      const clampedDiscount = rawDiscount.min(gross);
      const net = gross.subtractClampedZero(clampedDiscount);
      discountedLineTotals.set(item.lineKey, net);

      return {
        lineKey: item.lineKey,
        productId: item.productId,
        ...(item.variantId !== undefined ? { variantId: item.variantId } : {}),
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        grossSubtotal: gross,
        discount: clampedDiscount,
        netSubtotal: net,
      };
    });

    const tax = this.taxStrategy.calculate(cart, discountedLineTotals);
    const shipping = this.shippingStrategy.calculate(cart, netSubtotal);
    const grandTotal = netSubtotal.add(tax.totalTax).add(shipping.cost);

    return {
      cartId: cart.id,
      currency,
      version: cart.version,
      lines,
      grossSubtotal,
      totalDiscount,
      netSubtotal,
      appliedPromotions,
      tax,
      shipping,
      grandTotal,
    };
  }
}
