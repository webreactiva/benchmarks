/**
 * Agregado raíz del carrito.
 *
 * El carrito SOLO guarda referencias (`productId` + `quantity`): los precios y
 * nombres se resuelven contra el catálogo en el momento de leerlo. Así un cambio
 * de precio se refleja siempre con datos frescos y nunca se confía en precios
 * enviados por el cliente.
 */
export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  /** Código de descuento guardado (o null). Se re-evalúa en cada lectura. */
  discountCode: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Regla de negocio: unidades máximas por línea. */
export const MAX_QTY_PER_ITEM = 99;

/** Item enriquecido con datos del catálogo, para las respuestas de la API. */
export interface CartItemView {
  productId: string;
  name: string;
  emoji: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  stock: number;
}

/** Desglose de precios calculado por PricingService. */
export interface CartSummary {
  subtotalCents: number;
  discountCode: string | null;
  discountCents: number;
  taxRate: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
}

/** Representación del carrito que devuelve la API. */
export interface CartView {
  id: string;
  itemCount: number;
  items: CartItemView[];
  summary: CartSummary;
}
