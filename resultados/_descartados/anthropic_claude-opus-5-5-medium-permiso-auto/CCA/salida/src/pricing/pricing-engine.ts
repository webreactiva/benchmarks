/**
 * Motor de precios: calcula totales a partir del carrito. Es una función
 * pura y sin estado → escala horizontalmente y se puede cachear.
 */
import type { Cart } from '../domain/cart.ts';
import type { PromotionRegistry } from './promotions.ts';

export interface PricedLine {
  readonly sku: string;
  readonly name: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly lineTotal: number;
}

export interface Discount {
  readonly code: string;
  readonly description: string;
  readonly amount: number;
}

export interface CouponIssue {
  readonly code: string;
  readonly reason: string;
}

export interface CartTotals {
  readonly currency: string;
  readonly lines: readonly PricedLine[];
  readonly itemCount: number;
  readonly subtotal: number;
  readonly discounts: readonly Discount[];
  readonly discountTotal: number;
  readonly taxRateBasisPoints: number;
  readonly tax: number;
  readonly total: number;
  readonly couponIssues: readonly CouponIssue[];
}

export interface PricingOptions {
  /** Tipo impositivo en puntos básicos (2100 = 21 % IVA). */
  readonly taxRateBasisPoints: number;
}

export class PricingEngine {
  readonly promotions: PromotionRegistry;
  readonly #options: PricingOptions;

  constructor(promotions: PromotionRegistry, options: PricingOptions) {
    this.promotions = promotions;
    this.#options = options;
  }

  price(cart: Cart): CartTotals {
    const lines: PricedLine[] = cart.lines.map((l) => ({ ...l, lineTotal: l.unitPrice * l.quantity }));
    const subtotal = lines.reduce((acc, l) => acc + l.lineTotal, 0);
    const itemCount = lines.reduce((acc, l) => acc + l.quantity, 0);

    const discounts: Discount[] = [];
    const couponIssues: CouponIssue[] = [];
    let remaining = subtotal;

    // Primero automáticas, luego cupones en orden de aplicación.
    const candidates = [
      ...this.promotions.automatic().map((p) => ({ promo: p, code: p.code })),
      ...cart.couponCodes.map((code) => ({ promo: this.promotions.findCoupon(code), code })),
    ];

    for (const { promo, code } of candidates) {
      if (!promo) {
        couponIssues.push({ code, reason: 'Cupón inexistente o caducado' });
        continue;
      }
      if (remaining <= 0) break;
      const result = promo.evaluate({ lines: cart.lines, subtotal, remaining, currency: cart.currency });
      if (!result.applies) {
        if (promo.requiresCoupon) couponIssues.push({ code, reason: result.reason });
        continue;
      }
      const amount = Math.min(Math.max(0, Math.floor(result.amount)), remaining);
      if (amount === 0) continue;
      remaining -= amount;
      discounts.push({ code: promo.code, description: promo.description, amount });
    }

    const discountTotal = subtotal - remaining;
    const tax = Math.round((remaining * this.#options.taxRateBasisPoints) / 10_000);
    return {
      currency: cart.currency,
      lines,
      itemCount,
      subtotal,
      discounts,
      discountTotal,
      taxRateBasisPoints: this.#options.taxRateBasisPoints,
      tax,
      total: remaining + tax,
      couponIssues,
    };
  }
}
