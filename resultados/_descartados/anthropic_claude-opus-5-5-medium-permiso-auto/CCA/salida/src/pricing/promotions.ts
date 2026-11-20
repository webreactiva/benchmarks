/**
 * Promociones como estrategias intercambiables. Añadir una nueva promoción
 * = implementar `Promotion` y registrarla; el motor de precios no cambia.
 */
import type { CartLine } from '../domain/cart.ts';

export interface PromotionContext {
  readonly lines: readonly CartLine[];
  readonly subtotal: number;
  /** Importe restante tras aplicar descuentos previos (nunca negativo). */
  readonly remaining: number;
  readonly currency: string;
}

export type PromotionResult =
  | { readonly applies: true; readonly amount: number }
  | { readonly applies: false; readonly reason: string };

export interface Promotion {
  readonly code: string;
  readonly description: string;
  /** true: requiere que el cliente introduzca el cupón; false: automática. */
  readonly requiresCoupon: boolean;
  evaluate(ctx: PromotionContext): PromotionResult;
}

const notApplies = (reason: string): PromotionResult => ({ applies: false, reason });

/** Descuento porcentual expresado en puntos básicos (1000 = 10 %). */
export function percentageOff(code: string, basisPoints: number, opts: { minSubtotal?: number; description?: string } = {}): Promotion {
  return {
    code,
    requiresCoupon: true,
    description: opts.description ?? `${basisPoints / 100}% de descuento`,
    evaluate(ctx) {
      if (opts.minSubtotal && ctx.subtotal < opts.minSubtotal) return notApplies(`Requiere un subtotal mínimo de ${opts.minSubtotal}`);
      return { applies: true, amount: Math.floor((ctx.remaining * basisPoints) / 10_000) };
    },
  };
}

export function fixedAmountOff(code: string, amount: number, opts: { minSubtotal?: number; description?: string } = {}): Promotion {
  return {
    code,
    requiresCoupon: true,
    description: opts.description ?? `${amount} de descuento`,
    evaluate(ctx) {
      if (opts.minSubtotal && ctx.subtotal < opts.minSubtotal) return notApplies(`Requiere un subtotal mínimo de ${opts.minSubtotal}`);
      return { applies: true, amount };
    },
  };
}

/** "Compra X y llévate Y gratis" para un SKU. Automática. */
export function buyXGetYFree(code: string, sku: string, buy: number, free: number, description?: string): Promotion {
  return {
    code,
    requiresCoupon: false,
    description: description ?? `${buy + free}x${buy} en ${sku}`,
    evaluate(ctx) {
      const line = ctx.lines.find((l) => l.sku === sku);
      if (!line) return notApplies('Producto no presente');
      const groups = Math.floor(line.quantity / (buy + free));
      if (groups === 0) return notApplies(`Añade ${buy + free} unidades`);
      return { applies: true, amount: groups * free * line.unitPrice };
    },
  };
}

export class PromotionRegistry {
  readonly #coupons = new Map<string, Promotion>();
  readonly #automatic: Promotion[] = [];

  constructor(promotions: Iterable<Promotion> = []) {
    for (const p of promotions) this.register(p);
  }

  register(promotion: Promotion): this {
    if (promotion.requiresCoupon) this.#coupons.set(promotion.code.toUpperCase(), promotion);
    else this.#automatic.push(promotion);
    return this;
  }

  findCoupon(code: string): Promotion | undefined {
    return this.#coupons.get(code.toUpperCase());
  }

  automatic(): readonly Promotion[] {
    return this.#automatic;
  }
}
