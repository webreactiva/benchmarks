import type { Cart, CartMutation, MutationOutcome } from '../domain/cart.js';
import type { CartRepository, EventTemplate } from '../domain/ports.js';

/**
 * Repositorio resiliente: si Redis no responde, degrada a un repositorio en
 * memoria para no tumbar el servicio. La degradación se registra para que
 * sea visible en monitorización.
 *
 * Nota: los scripts Lua son atómicos, por lo que un error de red implica que
 * la mutación no se aplicó (o se aplicó sin confirmar la respuesta, caso en
 * el que la versión esperada protege contra la doble aplicación).
 */
export class ResilientCartRepository implements CartRepository {
  private degraded = false;

  constructor(
    private readonly primary: CartRepository,
    private readonly fallback: CartRepository,
    private readonly logger?: { warn: (obj: unknown, msg?: string) => void },
  ) {}

  get isDegraded(): boolean {
    return this.degraded;
  }

  async create(cart: Cart, event?: EventTemplate): Promise<Cart> {
    return this.run(() => this.primary.create(cart, event), () => this.fallback.create(cart, event));
  }

  async get(cartId: string): Promise<Cart | null> {
    return this.run(
      () => this.primary.get(cartId),
      () => this.fallback.get(cartId),
    );
  }

  async mutate(
    cartId: string,
    expectedVersion: number | null,
    mutation: CartMutation,
    event?: EventTemplate,
  ): Promise<MutationOutcome> {
    return this.run(
      () => this.primary.mutate(cartId, expectedVersion, mutation, event),
      () => this.fallback.mutate(cartId, expectedVersion, mutation, event),
    );
  }

  async merge(
    targetCartId: string,
    sourceCartId: string,
    expectedVersion: number | null,
    event?: EventTemplate,
  ): Promise<MutationOutcome> {
    return this.run(
      () => this.primary.merge(targetCartId, sourceCartId, expectedVersion, event),
      () => this.fallback.merge(targetCartId, sourceCartId, expectedVersion, event),
    );
  }

  async remove(cartId: string): Promise<void> {
    return this.run(
      () => this.primary.remove(cartId),
      () => this.fallback.remove(cartId),
    );
  }

  async findActiveByOwner(ownerId: string): Promise<Cart[]> {
    return this.run(
      () => this.primary.findActiveByOwner(ownerId),
      () => this.fallback.findActiveByOwner(ownerId),
    );
  }

  private async run<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      const result = await primary();
      if (this.degraded) {
        this.degraded = false;
        this.logger?.warn({}, 'Redis recuperado: se vuelve al repositorio principal');
      }
      return result;
    } catch (err) {
      if (!this.degraded) {
        this.degraded = true;
        this.logger?.warn({ err }, 'Redis no disponible: modo degradado en memoria');
      }
      return fallback();
    }
  }
}
