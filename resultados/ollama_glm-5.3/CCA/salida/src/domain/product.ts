/**
 * Entidad de catálogo.
 *
 * Escalabilidad: los precios se guardan en CÉNTIMOS (enteros) para evitar
 * errores de coma flotante. Operar con dinero en euros como `number` es un
 * bug clásico (0.1 + 0.2 !== 0.3).
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  /** Precio por unidad en céntimos (1234 = 12,34 €). */
  priceCents: number;
  /** Moneda ISO 4217. */
  currency: string;
  /** Unidades disponibles. */
  stock: number;
  category: string;
  /** Emoji decorativo para la UI de demostración. */
  emoji: string;
}
