import type { Cart } from '../domain/cart.js';
import type { Product } from '../domain/product.js';

/**
 * PUERTOS de persistencia (arquitectura hexagonal).
 *
 * Los servicios dependen de estas INTERFACES, nunca de una base de datos
 * concreta. Sustituir SQLite por PostgreSQL, Redis o una API externa es
 * simplemente escribir otro adaptador: el resto del código no cambia.
 *
 * Son asíncronos a propósito: el adaptador SQLite es síncrono por debajo, pero
 * así un adaptador de red (p. ej. un microservicio de catálogo) cae sin tocar
 * los servicios ni las rutas.
 */
export interface CartRepository {
  create(cart: Cart): Promise<void>;
  findById(id: string): Promise<Cart | null>;
  /** Guarda el agregado completo (upsert del carrito y sus líneas). */
  save(cart: Cart): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  /**
   * Ajusta el stock de forma atómica (`stock += delta`).
   * Devuelve `false` si el producto no existe o si el resultado sería negativo.
   */
  adjustStock(productId: string, delta: number): Promise<boolean>;
}
