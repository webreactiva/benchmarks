import { randomUUID } from 'node:crypto';
import { CartError, ErrorCodes } from './errors.js';
import * as cart from './cart.js';
import { calculateTotals } from './pricing.js';
import { EventBus } from './events.js';

/**
 * Capa de aplicación: une dominio puro (cart.js), precios (pricing.js),
 * persistencia (repository), catálogo y eventos.
 *
 * Escalabilidad:
 *  - El servicio no guarda estado en memoria: cualquier instancia puede atender
 *    cualquier petición, así que se escala horizontalmente detrás de un balanceador.
 *  - Cada mutación es "leer → calcular → guardar con versión". Si otra instancia
 *    se adelantó, el repositorio rechaza la escritura y aquí se reintenta con el
 *    estado fresco. No hay locks distribuidos.
 *  - El catálogo se consulta antes del bucle de reintentos, una sola vez por operación.
 *  - Los eventos se emiten solo tras una escritura confirmada.
 */
export class CartService {
  /**
   * @param {object} deps
   * @param {{get: Function, create: Function, save: Function}} deps.repository
   * @param {{getProducts: (skus: string[]) => Promise<Map<string, object>>}} deps.catalog
   * @param {{rules?: Array, taxRateBps?: number}} [deps.pricing]
   * @param {typeof cart.DEFAULT_LIMITS} [deps.limits]
   * @param {EventBus} [deps.events]
   * @param {number} [deps.maxRetries=5]
   */
  constructor({
    repository,
    catalog,
    pricing = {},
    limits = cart.DEFAULT_LIMITS,
    events = new EventBus(),
    maxRetries = 5,
  }) {
    this.repository = repository;
    this.catalog = catalog;
    this.pricing = pricing;
    this.limits = limits;
    this.events = events;
    this.maxRetries = maxRetries;
  }

  /** @param {{currency: string, id?: string}} params */
  async createCart({ currency, id = randomUUID() }) {
    const created = await this.repository.create(cart.createCart({ id, currency }));
    this.events.emit('cart.created', { cartId: id, currency: created.currency });
    return created;
  }

  /** @param {string} cartId */
  async getCart(cartId) {
    const found = await this.repository.get(cartId);
    if (!found) throw new CartError(ErrorCodes.CART_NOT_FOUND, `cart ${cartId} not found`);
    return found;
  }

  /** @param {string} cartId */
  async getTotals(cartId) {
    const found = await this.getCart(cartId);
    return calculateTotals(found, this.pricing);
  }

  /**
   * @param {string} cartId
   * @param {string} sku
   * @param {number} [quantity=1]
   */
  async addItem(cartId, sku, quantity = 1) {
    const product = await this.#resolveProduct(sku);
    return this.#mutate(cartId, 'item.added', (current) =>
      cart.addItem(current, product, quantity, this.limits),
    { sku, quantity });
  }

  /**
   * @param {string} cartId
   * @param {string} sku
   * @param {number} quantity  0 elimina la línea
   */
  async setQuantity(cartId, sku, quantity) {
    return this.#mutate(cartId, 'item.updated', (current) =>
      cart.setQuantity(current, sku, quantity, this.limits),
    { sku, quantity });
  }

  /** @param {string} cartId @param {string} sku */
  async removeItem(cartId, sku) {
    return this.#mutate(cartId, 'item.removed', (current) => cart.removeItem(current, sku), { sku });
  }

  /** @param {string} cartId */
  async clear(cartId) {
    return this.#mutate(cartId, 'cart.cleared', (current) => cart.clear(current));
  }

  /**
   * Resuelve el producto contra el catálogo y valida que exista.
   * @param {string} sku
   */
  async #resolveProduct(sku) {
    const products = await this.catalog.getProducts([sku]);
    const product = products.get(sku);
    if (!product) throw new CartError(ErrorCodes.PRODUCT_NOT_FOUND, `product ${sku} not found`);
    return product;
  }

  /**
   * Bucle optimista: lee, aplica la transformación pura y guarda. Ante conflicto
   * de versión reintenta con el estado más reciente.
   *
   * @param {string} cartId
   * @param {string} eventType
   * @param {(current: object) => object} transform
   * @param {object} [eventData]
   */
  async #mutate(cartId, eventType, transform, eventData = {}) {
    for (let attempt = 0; ; attempt++) {
      const current = await this.getCart(cartId);
      const next = transform(current);
      try {
        const saved = await this.repository.save(next);
        this.events.emit(eventType, { cartId, version: saved.version, ...eventData });
        return saved;
      } catch (error) {
        const retryable = error instanceof CartError && error.code === ErrorCodes.CONCURRENCY_CONFLICT;
        if (!retryable || attempt >= this.maxRetries) throw error;
      }
    }
  }
}
