import { EventEmitter } from './EventEmitter.js';
import { toCents } from './money.js';

const DEFAULT_QTY = 1;
const MAX_QTY = 99;

export class Cart extends EventEmitter {
  constructor({ storage = null, pricing = null, currency = 'EUR', autoPersist = true } = {}) {
    super();
    this.storage = storage;
    this.pricing = pricing;
    this.currency = currency;
    this.autoPersist = autoPersist;
    this._items = new Map();
    this.coupon = null;
    this._load();
  }

  get items() {
    return [...this._items.values()].map(({ product, qty }) => ({
      product,
      qty,
      lineTotalCents: this._priceOf(product) * qty,
    }));
  }

  get count() {
    let total = 0;
    for (const { qty } of this._items.values()) {
      total += qty;
    }
    return total;
  }

  get isEmpty() {
    return this._items.size === 0;
  }

  get state() {
    return {
      items: this.items.map(({ product, qty }) => ({
        productId: product.id,
        name: product.name,
        category: product.category,
        priceCents: this._priceOf(product),
        qty,
      })),
      coupon: this.coupon,
      currency: this.currency,
    };
  }

  add(product, qty = DEFAULT_QTY) {
    if (!product?.id) {
      throw new TypeError('El producto debe tener un id');
    }

    const quantity = this._normalizeQty(qty);
    const priceCents = product.priceCents ?? toCents(product.price);
    const existing = this._items.get(product.id);

    if (existing) {
      existing.qty = Math.min(MAX_QTY, existing.qty + quantity);
    } else {
      this._items.set(product.id, {
        product: { ...product, priceCents },
        qty: quantity,
      });
    }

    this._commit('cart:item-added', { productId: product.id, qty: quantity });
    return this;
  }

  setQty(productId, qty) {
    const item = this._items.get(productId);
    if (!item) {
      return this;
    }

    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return this.remove(productId);
    }

    item.qty = Math.min(MAX_QTY, Math.floor(quantity));
    this._commit('cart:item-updated', { productId, qty: item.qty });
    return this;
  }

  increment(productId, delta = 1) {
    const item = this._items.get(productId);
    if (!item) {
      return this;
    }
    return this.setQty(productId, item.qty + Number(delta));
  }

  remove(productId) {
    if (!this._items.delete(productId)) {
      return this;
    }
    if (this._items.size === 0) {
      this.coupon = null;
    }
    this._commit('cart:item-removed', { productId });
    return this;
  }

  clear() {
    if (this._items.size === 0 && !this.coupon) {
      return this;
    }
    this._items.clear();
    this.coupon = null;
    this._commit('cart:cleared');
    return this;
  }

  applyCoupon(coupon) {
    if (!coupon || typeof coupon !== 'object' || !coupon.code) {
      throw new TypeError('Cupón inválido');
    }
    this.coupon = { ...coupon };
    this._commit('cart:coupon-applied', { code: coupon.code });
    return this;
  }

  removeCoupon() {
    if (!this.coupon) {
      return this;
    }
    this.coupon = null;
    this._commit('cart:coupon-removed');
    return this;
  }

  totals() {
    return this.pricing ? this.pricing.calculate(this.state) : null;
  }

  serialize() {
    return {
      items: this.items.map(({ product, qty }) => ({
        product: {
          id: product.id,
          name: product.name,
          category: product.category,
          image: product.image,
          color: product.color,
          priceCents: this._priceOf(product),
        },
        qty,
      })),
      coupon: this.coupon,
    };
  }

  hydrate(state, { silent = false } = {}) {
    if (!state || typeof state !== 'object') {
      return this;
    }

    this._items.clear();
    for (const entry of state.items ?? []) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const product = entry.product ?? entry;
      if (!product?.id) {
        continue;
      }
      const priceCents = product.priceCents ?? toCents(product.price);
      const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(entry.qty) || DEFAULT_QTY)));
      this._items.set(product.id, {
        product: { ...product, priceCents },
        qty,
      });
    }
    this.coupon = state.coupon ?? null;

    if (!silent) {
      this._commit('cart:hydrated');
    }
    return this;
  }

  _load() {
    if (!this.storage) {
      return;
    }
    const state = this.storage.load();
    if (state) {
      this.hydrate(state, { silent: true });
    }
  }

  _priceOf(product) {
    return product.priceCents ?? toCents(product.price);
  }

  _normalizeQty(qty) {
    const quantity = Math.floor(Number(qty));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return DEFAULT_QTY;
    }
    return Math.min(MAX_QTY, quantity);
  }

  _commit(event, detail = {}) {
    this.emit('change', { event, ...detail, cart: this });
    this.emit(event, detail);
    if (this.autoPersist && this.storage) {
      this.storage.save(this.serialize());
    }
  }
}
