// Casos de uso del carrito. No sabe nada de HTTP ni de Redis: recibe los
// puertos por inyección de dependencias.
//
// Claves de escalabilidad:
//   * Sin estado en el proceso: todo vive en el repositorio → escalado horizontal.
//   * Concurrencia optimista (versión) con reintentos automáticos: dos pestañas
//     o dos réplicas modificando el mismo carrito nunca pierden actualizaciones,
//     y no hacen falta locks distribuidos.
//   * Precios y stock siempre desde el catálogo (fuente de verdad), consultados
//     en lote (getMany) para minimizar llamadas de red.
//   * Eventos de dominio publicados tras cada cambio → analítica, recuperación de
//     carritos abandonados, recomendaciones... desacoplados del camino crítico.

import * as Cart from '../domain/cart.js';
import { priceCart } from '../domain/pricing.js';
import { ConcurrencyError, NotFoundError, OutOfStockError, ValidationError } from '../domain/errors.js';

export class CartService {
  constructor({
    repository,
    catalog,
    coupons,
    eventBus,
    pricing = { rules: [], taxRate: 21, shipping: { flat: 0, freeOver: null } },
    limits = Cart.DEFAULT_LIMITS,
    maxRetries = 5,
    now = Date.now,
  }) {
    Object.assign(this, { repository, catalog, coupons, eventBus, pricing, limits, maxRetries, now });
  }

  // ---- Lectura ---------------------------------------------------------------

  /**
   * Devuelve el carrito con precios ACTUALES del catálogo y avisos (producto
   * retirado, sin stock, precio cambiado, cupón caducado). No escribe nada, así
   * que las lecturas escalan con réplicas de lectura / cachés.
   */
  async view(cartId) {
    const cart = await this.load(cartId);
    return this.present(cart);
  }

  async present(cart) {
    const warnings = [];
    const products = await this.catalog.getMany(cart.items.map((i) => i.sku));

    const items = [];
    for (const item of cart.items) {
      const p = products.get(item.sku);
      if (!p || !p.active) {
        warnings.push({ code: 'PRODUCT_UNAVAILABLE', sku: item.sku });
        continue; // no se cobra lo que ya no se vende
      }
      if (p.price !== item.unitPrice) {
        warnings.push({ code: 'PRICE_CHANGED', sku: item.sku, from: item.unitPrice, to: p.price });
      }
      if (p.stock != null && p.stock < item.quantity) {
        warnings.push({ code: 'INSUFFICIENT_STOCK', sku: item.sku, available: p.stock });
      }
      items.push({ ...item, name: p.name, unitPrice: p.price });
    }

    const couponRules = [];
    for (const code of cart.coupons) {
      const rule = await this.coupons.find(code);
      if (rule) couponRules.push(rule);
      else warnings.push({ code: 'COUPON_INVALID', coupon: code });
    }

    const totals = priceCart({ ...cart, items }, {
      ...this.pricing,
      rules: [...(this.pricing.rules ?? []), ...couponRules],
    });

    return {
      id: cart.id,
      ownerId: cart.ownerId,
      version: cart.version,
      coupons: cart.coupons,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      ...totals,
      warnings,
    };
  }

  // ---- Escritura -------------------------------------------------------------

  async create({ ownerId = null, currency = 'EUR' } = {}) {
    const cart = Cart.createCart({ ownerId, currency, now: this.now() });
    const saved = await this.repository.save(cart, 0);
    await this.emit('cart.created', saved);
    return this.present(saved);
  }

  /** Suma `quantity` unidades al producto (lo crea si no estaba). */
  async addItem(cartId, { sku, quantity = 1 }, opts) {
    Cart.assertSku(sku);
    if (!Number.isInteger(quantity) || quantity < 1) throw new ValidationError('quantity debe ser un entero >= 1');
    return this.mutate(cartId, opts, 'cart.item_added', { sku, quantity }, async (cart) => {
      const target = Cart.getQuantity(cart, sku) + quantity;
      return this.setFromCatalog(cart, sku, target);
    });
  }

  /** Fija la cantidad exacta (0 elimina). */
  async updateItem(cartId, sku, quantity, opts) {
    Cart.assertSku(sku);
    Cart.assertQuantity(quantity, this.limits);
    return this.mutate(cartId, opts, 'cart.item_updated', { sku, quantity }, async (cart) => {
      if (quantity === 0) return Cart.removeItem(cart, sku, { now: this.now() });
      return this.setFromCatalog(cart, sku, quantity);
    });
  }

  async removeItem(cartId, sku, opts) {
    return this.mutate(cartId, opts, 'cart.item_removed', { sku }, async (cart) =>
      Cart.removeItem(cart, sku, { now: this.now() }),
    );
  }

  async applyCoupon(cartId, code, opts) {
    const normalized = Cart.normalizeCoupon(code);
    const rule = await this.coupons.find(normalized);
    if (!rule) throw new NotFoundError(`Cupón ${normalized} no válido o caducado`);
    return this.mutate(cartId, opts, 'cart.coupon_applied', { code: normalized }, async (cart) =>
      Cart.addCoupon(cart, normalized, { limits: this.limits, now: this.now() }),
    );
  }

  async removeCoupon(cartId, code, opts) {
    return this.mutate(cartId, opts, 'cart.coupon_removed', { code }, async (cart) =>
      Cart.removeCoupon(cart, code, { now: this.now() }),
    );
  }

  async clear(cartId, opts) {
    return this.mutate(cartId, opts, 'cart.cleared', {}, async (cart) => Cart.clearCart(cart, { now: this.now() }));
  }

  /**
   * Fusiona el carrito `sourceId` (p. ej. el de invitado) en `targetId` (el del
   * usuario tras hacer login) y elimina el origen. Respeta límites y stock.
   */
  async merge(targetId, sourceId, opts) {
    if (targetId === sourceId) throw new ValidationError('No se puede fusionar un carrito consigo mismo');
    const source = await this.load(sourceId);

    const result = await this.mutate(targetId, opts, 'cart.merged', { sourceId }, async (target) => {
      const quantities = Cart.mergedQuantities(target, source, this.limits);
      const products = await this.catalog.getMany([...quantities.keys()]);
      let cart = target;
      for (const [sku, qty] of quantities) {
        const p = products.get(sku);
        if (!p || !p.active) continue;
        const capped = p.stock == null ? qty : Math.min(qty, p.stock);
        if (capped <= 0) continue;
        try {
          cart = Cart.setItem(cart, { sku, name: p.name, unitPrice: p.price, quantity: capped }, { limits: this.limits, now: this.now() });
        } catch (err) {
          if (err.code !== 'LIMIT_EXCEEDED') throw err; // si no caben más líneas, se descartan
        }
      }
      for (const code of source.coupons) {
        try {
          cart = Cart.addCoupon(cart, code, { limits: this.limits, now: this.now() });
        } catch (err) {
          if (err.code !== 'LIMIT_EXCEEDED') throw err;
        }
      }
      return cart;
    });

    await this.repository.delete(sourceId);
    return result;
  }

  async delete(cartId) {
    const deleted = await this.repository.delete(cartId);
    if (!deleted) throw new NotFoundError(`Carrito ${cartId} no encontrado`);
    await this.eventBus.publish({ type: 'cart.deleted', cartId, at: this.now() });
  }

  // ---- Internos --------------------------------------------------------------

  async load(cartId) {
    const cart = await this.repository.get(cartId);
    if (!cart) throw new NotFoundError(`Carrito ${cartId} no encontrado`);
    return cart;
  }

  async setFromCatalog(cart, sku, quantity) {
    const p = (await this.catalog.getMany([sku])).get(sku);
    if (!p || !p.active) throw new NotFoundError(`Producto ${sku} no disponible`);
    if (p.stock != null && p.stock < quantity) throw new OutOfStockError(sku, p.stock);
    return Cart.setItem(cart, { sku, name: p.name, unitPrice: p.price, quantity }, { limits: this.limits, now: this.now() });
  }

  /**
   * Lee → aplica `fn` → guarda con compare-and-set.
   * - Si el cliente envía `expectedVersion` (cabecera If-Match) y no coincide,
   *   se devuelve 409 sin reintentar: el cliente decidió sobre un estado viejo.
   * - Si no, ante un conflicto se vuelve a leer y reaplicar la operación
   *   (las operaciones son funciones puras, así que es seguro).
   */
  async mutate(cartId, { expectedVersion } = {}, eventType, payload, fn) {
    for (let attempt = 0; ; attempt++) {
      const cart = await this.load(cartId);
      if (expectedVersion != null && cart.version !== expectedVersion) {
        throw new ConcurrencyError(cartId, expectedVersion, cart.version);
      }
      const next = await fn(cart);
      if (next === cart) return this.present(cart); // sin cambios: no se escribe

      try {
        const saved = await this.repository.save(next, cart.version);
        await this.emit(eventType, saved, payload);
        return this.present(saved);
      } catch (err) {
        if (!(err instanceof ConcurrencyError) || expectedVersion != null || attempt >= this.maxRetries) throw err;
        // Backoff exponencial con jitter para no sincronizar a los contendientes.
        await new Promise((r) => setTimeout(r, Math.random() * 5 * 2 ** attempt));
      }
    }
  }

  async emit(type, cart, payload = {}) {
    await this.eventBus.publish({
      type,
      cartId: cart.id,
      ownerId: cart.ownerId,
      version: cart.version,
      at: this.now(),
      ...payload,
    });
  }
}
