import { createHash } from 'node:crypto';
import type { Currency } from './money.js';

export interface VolumeBreak {
  minQuantity: number;
  discountBps: number;
}

export interface CatalogProduct {
  productId: string;
  variantId: string | null;
  sku: string;
  name: string;
  unitPriceCents: number;
  currency: Currency;
  active: boolean;
  stock: number;
  volumeBreaks: VolumeBreak[];
  metadata: Record<string, string>;
}

export interface CatalogLookup {
  productId: string;
  variantId?: string | null;
}

export interface Catalog {
  getProduct(lookup: CatalogLookup): Promise<CatalogProduct | null>;
}

/**
 * Identificador de línea determinista: el mismo producto+variante siempre cae
 * en la misma línea, lo que permite que las mutaciones concurrentes sobre
 * "la misma referencia" converjan sin duplicados.
 */
export function computeLineId(productId: string, variantId: string | null): string {
  return createHash('sha256')
    .update(`${productId}::${variantId ?? ''}`)
    .digest('hex')
    .slice(0, 24);
}

export function resolveVolumeBreak(breaks: VolumeBreak[], quantity: number): number {
  let bps = 0;
  for (const br of breaks) {
    if (quantity >= br.minQuantity && br.discountBps > bps) {
      bps = br.discountBps;
    }
  }
  return bps;
}
