import type { CartItemView, CartSummary } from '../domain/cart.js';

/**
 * Estrategia de descuento. Añadir un tipo nuevo ("envío gratis", "2x1", …)
 * es ampliar este union y su manejo en `price()`, sin tocar nada más.
 */
export interface DiscountRule {
  code: string;
  type: 'percent' | 'fixed';
  /** % (para 'percent') o céntimos (para 'fixed'). */
  value: number;
  /** Compra mínima en céntimos para poder aplicarlo. */
  minSubtotalCents?: number;
}

export interface PricingConfig {
  /** Impuesto sobre el importe gravable (0.21 = IVA del 21 %). */
  taxRate: number;
  shippingCents: number;
  freeShippingThresholdCents: number;
  /** Códigos activos, indexados en MAYÚSCULAS. */
  discounts: Record<string, DiscountRule>;
}

/**
 * Todas las reglas de precio del sistema viven aquí: una sola fuente de verdad.
 * Todos los importes son céntimos enteros y se redondea una vez por concepto,
 * de modo que la suma del desglose siempre cuadra exactamente.
 */
export class PricingService {
  constructor(private readonly config: PricingConfig) {}

  /** Busca el código tal cual se escribe; normaliza espacios y mayúsculas. */
  findDiscount(code: string): DiscountRule | null {
    return this.config.discounts[code.trim().toUpperCase()] ?? null;
  }

  price(items: CartItemView[], discountCode: string | null): CartSummary {
    const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);

    // Se re-evalúa en cada lectura: si el carrito baja del mínimo, el código
    // deja de aplicarse (con discountCents = 0 y discountCode = null).
    let discountCents = 0;
    let appliedCode: string | null = null;
    const rule = discountCode ? this.findDiscount(discountCode) : null;
    if (rule && subtotalCents >= (rule.minSubtotalCents ?? 0)) {
      discountCents =
        rule.type === 'percent'
          ? Math.round((subtotalCents * rule.value) / 100)
          : Math.min(rule.value, subtotalCents);
      appliedCode = rule.code;
    }

    const taxableBase = subtotalCents - discountCents;
    const shippingCents =
      subtotalCents === 0 || taxableBase >= this.config.freeShippingThresholdCents
        ? 0
        : this.config.shippingCents;

    const taxCents = Math.round((taxableBase + shippingCents) * this.config.taxRate);
    const totalCents = taxableBase + shippingCents + taxCents;

    return {
      subtotalCents,
      discountCode: appliedCode,
      discountCents,
      taxRate: this.config.taxRate,
      taxCents,
      shippingCents,
      totalCents,
    };
  }
}
