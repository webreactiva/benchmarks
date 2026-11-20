import type { Cart } from '../domain/cart.ts';

export interface CartRepository {
  get(id: string): Promise<Cart | null>;
  /**
   * Compare-and-set: guarda `cart` sólo si la versión almacenada es
   * `expectedVersion` (0 = el carrito no existe). Lanza ConcurrencyError si no.
   * Renueva el TTL: los carritos abandonados caducan solos.
   */
  save(cart: Cart, expectedVersion: number, ttlSeconds: number): Promise<void>;
  /** Índice usuario → carrito activo. */
  findActiveCartId(ownerId: string): Promise<string | null>;
  setActiveCartId(ownerId: string, cartId: string, ttlSeconds: number): Promise<void>;
  /** Borra el índice sólo si apunta a `cartId`. */
  clearActiveCartId(ownerId: string, cartId: string): Promise<void>;
}

export type IdempotencyRecord =
  | { readonly state: 'in_progress'; readonly fingerprint: string }
  | { readonly state: 'completed'; readonly fingerprint: string; readonly status: number; readonly body: unknown };

export interface IdempotencyStore {
  /** Reclama la clave atómicamente. Si ya existía devuelve el registro previo. */
  claim(key: string, fingerprint: string, ttlSeconds: number): Promise<IdempotencyRecord | null>;
  complete(key: string, record: IdempotencyRecord & { state: 'completed' }, ttlSeconds: number): Promise<void>;
  release(key: string): Promise<void>;
}
