import { CartError, ErrorCodes } from './errors.js';

/**
 * Contrato de persistencia. Cualquier backend (Redis, DynamoDB, PostgreSQL...)
 * debe cumplir esta interfaz; el servicio no sabe nada del almacenamiento.
 *
 *   get(id)        -> Promise<cart | null>
 *   create(cart)   -> Promise<cart>            (falla si ya existe)
 *   save(cart)     -> Promise<cart>            (cart.version debe coincidir con la almacenada)
 *
 * `save` implementa control de concurrencia optimista: solo escribe si la
 * versión almacenada es la que el cliente leyó; si no, lanza CONCURRENCY_CONFLICT
 * y el servicio reintenta. Así varias instancias pueden atender el mismo carrito
 * sin bloqueos distribuidos.
 *
 * Equivalente SQL de referencia:
 *   UPDATE carts SET lines = $1, version = version + 1
 *    WHERE id = $2 AND version = $3;   -- 0 filas => CONCURRENCY_CONFLICT
 */
export class InMemoryCartRepository {
  /** @type {Map<string, object>} */
  #carts = new Map();

  async get(id) {
    return this.#carts.get(id) ?? null;
  }

  async create(cart) {
    if (this.#carts.has(cart.id)) {
      throw new CartError(ErrorCodes.CART_ALREADY_EXISTS, `cart ${cart.id} already exists`);
    }
    const stored = Object.freeze({ ...cart, version: 0 });
    this.#carts.set(cart.id, stored);
    return stored;
  }

  async save(cart) {
    // Todo lo que hay entre el get y el set de este método es síncrono, así que
    // es atómico respecto a otras llamadas en el mismo proceso.
    const current = this.#carts.get(cart.id);
    if (!current) {
      throw new CartError(ErrorCodes.CART_NOT_FOUND, `cart ${cart.id} not found`);
    }
    if (current.version !== cart.version) {
      throw new CartError(ErrorCodes.CONCURRENCY_CONFLICT, `cart ${cart.id} was modified concurrently`);
    }
    const stored = Object.freeze({ ...cart, version: cart.version + 1 });
    this.#carts.set(cart.id, stored);
    return stored;
  }
}
