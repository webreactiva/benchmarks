import type { Cart, CartItem, CartMutation } from '../domain/cart.js';
import { emptyTotals } from '../domain/cart.js';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Normaliza el JSON que devuelve Lua. `cjson` codifica las tablas vacías como
 * `{}` en lugar de `[]`, por lo que hay que proteger los campos de tipo array.
 */
export function normalizeCart(raw: unknown): Cart {
  const data = raw as Partial<Cart> & Record<string, unknown>;
  const items = asArray<Record<string, unknown>>(data.items).map((item) =>
    normalizeItem(item),
  );
  const totals = (data.totals as Cart['totals'] | undefined) ?? emptyTotals(
    (data.currency as Cart['currency']) ?? 'EUR',
  );

  return {
    id: String(data.id ?? ''),
    ownerId: (data.ownerId as string | null) ?? null,
    sessionId: (data.sessionId as string | null) ?? null,
    currency: (data.currency as Cart['currency']) ?? 'EUR',
    status: (data.status as Cart['status']) ?? 'active',
    items,
    promoCodes: asArray<string>(data.promoCodes),
    totals: {
      ...emptyTotals((data.currency as Cart['currency']) ?? 'EUR'),
      ...totals,
    },
    version: Number(data.version ?? 0),
    createdAt: String(data.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(data.updatedAt ?? new Date(0).toISOString()),
    expiresAt: String(data.expiresAt ?? new Date(0).toISOString()),
  };
}

function normalizeItem(item: Record<string, unknown>): CartItem {
  const breaks = asArray<{ minQuantity: number; discountBps: number }>(item.volumeBreaks);
  const metadata = (item.metadata ?? {}) as Record<string, string>;
  return {
    lineId: String(item.lineId ?? ''),
    productId: String(item.productId ?? ''),
    variantId: (item.variantId as string | null) ?? null,
    sku: String(item.sku ?? ''),
    name: String(item.name ?? ''),
    unitPriceCents: Number(item.unitPriceCents ?? 0),
    quantity: Number(item.quantity ?? 0),
    discountBps: Number(item.discountBps ?? 0),
    discountCents: Number(item.discountCents ?? 0),
    promoCents: Number(item.promoCents ?? 0),
    lineTotalCents: Number(item.lineTotalCents ?? 0),
    volumeBreaks: breaks.map((b) => ({
      minQuantity: Number(b.minQuantity),
      discountBps: Number(b.discountBps),
    })),
    metadata: typeof metadata === 'object' ? metadata : {},
  };
}

/** Serializa la mutación al payload que consume el script Lua. */
export function serializeMutation(mutation: CartMutation): { op: string; payload: unknown } {
  switch (mutation.kind) {
    case 'add_item':
      return { op: 'add_item', payload: { item: mutation.item } };
    case 'set_quantity':
      return { op: 'set_quantity', payload: { lineId: mutation.lineId, quantity: mutation.quantity } };
    case 'remove_item':
      return { op: 'remove_item', payload: { lineId: mutation.lineId } };
    case 'clear':
      return { op: 'clear', payload: {} };
    case 'apply_promo':
      return { op: 'apply_promo', payload: { code: mutation.code } };
    case 'remove_promo':
      return { op: 'remove_promo', payload: { code: mutation.code } };
    case 'checkout':
      return { op: 'checkout', payload: {} };
  }
}
