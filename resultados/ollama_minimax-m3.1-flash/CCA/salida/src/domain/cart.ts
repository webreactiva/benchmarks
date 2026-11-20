import type { Currency } from './money.js';

export type CartStatus = 'active' | 'checked_out' | 'abandoned';

export interface CartItem {
  lineId: string;
  productId: string;
  variantId: string | null;
  sku: string;
  name: string;
  /** Precio unitario en unidades menores (céntimos). */
  unitPriceCents: number;
  quantity: number;
  /** Descuento de volumen aplicable a la línea, en basis points. */
  discountBps: number;
  /** Descuento de la línea ya aplicado, en unidades menores. */
  discountCents: number;
  /** Descuento de cupón prorrateado a la línea, en unidades menores. */
  promoCents: number;
  /** Total de la línea: (precio * cantidad) - descuentos. */
  lineTotalCents: number;
  /** Reglas de volumen serializadas para poder recalcular en Lua. */
  volumeBreaks: Array<{ minQuantity: number; discountBps: number }>;
  metadata: Record<string, string>;
}

export interface CartTotals {
  currency: Currency;
  subtotalCents: number;
  discountCents: number;
  promoCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  itemCount: number;
}

export interface Cart {
  id: string;
  ownerId: string | null;
  sessionId: string | null;
  currency: Currency;
  status: CartStatus;
  items: CartItem[];
  promoCodes: string[];
  totals: CartTotals;
  /** Versión monotonica; se incrementa en cada mutación aceptada. */
  version: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export type CartMutation =
  | { kind: 'add_item'; item: CartItem }
  | { kind: 'set_quantity'; lineId: string; quantity: number }
  | { kind: 'remove_item'; lineId: string }
  | { kind: 'clear' }
  | { kind: 'apply_promo'; code: string }
  | { kind: 'remove_promo'; code: string }
  | { kind: 'checkout' };

export type MutationOutcome =
  | { status: 'ok'; cart: Cart }
  | { status: 'not_found' }
  | { status: 'conflict'; current: Cart }
  | { status: 'invalid'; code: string; message: string; details?: Record<string, unknown> };

export function emptyTotals(currency: Currency): CartTotals {
  return {
    currency,
    subtotalCents: 0,
    discountCents: 0,
    promoCents: 0,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 0,
    itemCount: 0,
  };
}

export function itemCount(items: CartItem[]): number {
  let total = 0;
  for (const item of items) total += item.quantity;
  return total;
}
