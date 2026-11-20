import type { Cart } from '../../domain/cart.js';
import type { CartRepository } from '../../ports/repositories.js';

/**
 * Adaptador en memoria del puerto CartRepository.
 * Ideal para tests y para ejecutar sin disco (STORAGE=memory).
 */
export class MemoryCartRepository implements CartRepository {
  private readonly carts = new Map<string, Cart>();

  async create(cart: Cart): Promise<void> {
    this.carts.set(cart.id, structuredClone(cart));
  }

  async findById(id: string): Promise<Cart | null> {
    const cart = this.carts.get(id);
    return cart ? structuredClone(cart) : null;
  }

  async save(cart: Cart): Promise<void> {
    this.carts.set(cart.id, structuredClone(cart));
  }

  async delete(id: string): Promise<void> {
    this.carts.delete(id);
  }
}
