import { invalid, unknownSku } from './errors.js';

const CART_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SKU = /^[A-Za-z0-9._-]{1,64}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Lógica del carrito. No guarda estado propio: todo vive en `store`, así que
 * se pueden ejecutar tantas instancias como haga falta detrás de un balanceador.
 */
export class CartService {
  constructor({ store, catalog, limits }) {
    this.store = store;
    this.catalog = catalog;
    this.limits = limits;
  }

  async getCart(cartId) {
    this.#assertCartId(cartId);
    return this.#view(cartId);
  }

  /** Suma `quantity` unidades. Con `idempotencyKey`, un reintento no vuelve a sumar. */
  async addItem(cartId, sku, quantity, { idempotencyKey } = {}) {
    this.#assertCartId(cartId);
    this.#assertQuantity(quantity);
    if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw invalid('Idempotency-Key no válida');
    }
    await this.#assertProductExists(sku);
    await this.store.addItem(cartId, sku, quantity, { idempotencyKey });
    return this.#view(cartId);
  }

  /** Fija la cantidad exacta de una línea (operación idempotente por naturaleza). */
  async setItem(cartId, sku, quantity) {
    this.#assertCartId(cartId);
    this.#assertQuantity(quantity);
    await this.#assertProductExists(sku);
    await this.store.setItem(cartId, sku, quantity);
    return this.#view(cartId);
  }

  async removeItem(cartId, sku) {
    this.#assertCartId(cartId);
    if (!SKU.test(sku)) throw invalid('SKU no válido');
    await this.store.removeItem(cartId, sku);
    return this.#view(cartId);
  }

  async clear(cartId) {
    this.#assertCartId(cartId);
    await this.store.clear(cartId);
  }

  async #view(cartId) {
    const quantities = await this.store.getItems(cartId);
    const skus = Object.keys(quantities).sort();
    const products = await this.catalog.getMany(skus);

    let subtotal = 0;
    let totalQuantity = 0;
    const items = skus.map((sku) => {
      const quantity = quantities[sku];
      const product = products.get(sku);
      // Un producto retirado del catálogo sigue viéndose, pero no suma al total.
      if (!product) return { sku, quantity, available: false };
      const lineTotal = product.price * quantity;
      subtotal += lineTotal;
      totalQuantity += quantity;
      return { sku, name: product.name, unitPrice: product.price, quantity, lineTotal, available: true };
    });

    // Importes en unidades mínimas de la moneda (céntimos) para evitar errores de coma flotante.
    return { id: cartId, items, totalQuantity, subtotal, currency: this.catalog.currency };
  }

  #assertCartId(cartId) {
    if (!CART_ID.test(cartId)) throw invalid('Identificador de carrito no válido');
  }

  #assertQuantity(quantity) {
    const max = this.limits.maxQuantityPerLine;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
      throw invalid(`"quantity" debe ser un entero entre 1 y ${max}`);
    }
  }

  async #assertProductExists(sku) {
    if (typeof sku !== 'string' || !SKU.test(sku)) throw invalid('SKU no válido');
    const found = await this.catalog.getMany([sku]);
    if (!found.has(sku)) throw unknownSku(sku);
  }
}
