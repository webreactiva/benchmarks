import type { Cart, CartMutation, MutationOutcome } from './cart.js';

export interface CartRepository {
  create(cart: Cart, event?: EventTemplate): Promise<Cart>;
  get(cartId: string): Promise<Cart | null>;
  /**
   * Aplica una mutación de forma atómica. `expectedVersion === null` significa
   * "última escritura gana"; un número exige que la versión actual coincida
   * (control de concurrencia optimista) para evitar sobrescrituras perdidas.
   */
  mutate(
    cartId: string,
    expectedVersion: number | null,
    mutation: CartMutation,
    event?: EventTemplate,
  ): Promise<MutationOutcome>;
  merge(
    targetCartId: string,
    sourceCartId: string,
    expectedVersion: number | null,
    event?: EventTemplate,
  ): Promise<MutationOutcome>;
  remove(cartId: string): Promise<void>;
  findActiveByOwner(ownerId: string): Promise<Cart[]>;
}

export interface EventTemplate {
  id: string;
  type: string;
  occurredAt: string;
  actorId: string | null;
  payload: Record<string, unknown>;
}

export interface StoredResponse {
  statusCode: number;
  body: unknown;
}

export interface IdempotencyStore {
  get(key: string): Promise<StoredResponse | null>;
  /** Intenta adquirir el bloqueo de la clave. Devuelve true si se consigue. */
  lock(key: string, token: string, ttlSeconds: number): Promise<boolean>;
  /** Libera el bloqueo solo si el token coincide. */
  release(key: string, token: string): Promise<void>;
  save(key: string, response: StoredResponse, ttlSeconds: number): Promise<void>;
  /** Espera a que otro worker con la misma clave complete la operación. */
  waitForResult(key: string, timeoutMs: number): Promise<StoredResponse | null>;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, cost?: number): Promise<RateLimitResult>;
}

export interface DomainEvent {
  id: string;
  type: string;
  occurredAt: string;
  cartId: string;
  version: number;
  actorId: string | null;
  payload: Record<string, unknown>;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
