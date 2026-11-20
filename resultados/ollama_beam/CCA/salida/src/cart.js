const { EventEmitter } = require('node:events');

class CartItem {
  constructor({ productId, name, price, quantity, metadata }) {
    this.productId = String(productId);
    this.name = name == null ? '' : String(name);
    this.price = Number(price);
    this.quantity = Number(quantity);
    this.metadata = metadata || {};
  }
  validate() {
    if (!this.productId) throw new Error('productId required');
    if (!Number.isFinite(this.price) || this.price < 0) throw new Error('invalid price');
    if (!Number.isInteger(this.quantity) || this.quantity <= 0) throw new Error('invalid quantity');
  }
  total() { return this.price * this.quantity; }
  toJSON() { return { ...this }; }
}

class Cart {
  constructor({ id, userId, currency = 'USD', taxRate = 0, items = [], discounts = [], version = 0 } = {}) {
    this.id = id;
    this.userId = userId;
    this.currency = currency;
    this.taxRate = taxRate;
    this.items = new Map(items.map((i) => [String(i.productId), new CartItem(i)]));
    this.discounts = [...discounts];
    this.version = version;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
  }
  touch() { this.updatedAt = new Date().toISOString(); this.version += 1; }

  addItem(item) {
    const ci = item instanceof CartItem ? item : new CartItem(item);
    ci.validate();
    const existing = this.items.get(ci.productId);
    if (existing) {
      existing.quantity += ci.quantity;
      existing.price = ci.price;
      existing.name = ci.name;
      existing.metadata = { ...existing.metadata, ...ci.metadata };
      existing.validate();
    } else {
      this.items.set(ci.productId, ci);
    }
    this.touch();
    return this;
  }

  updateQuantity(productId, quantity) {
    const key = String(productId);
    const item = this.items.get(key);
    if (!item) throw new Error('item not found');
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 0) throw new Error('invalid quantity');
    if (q === 0) this.items.delete(key);
    else { item.quantity = q; item.validate(); }
    this.touch();
    return this;
  }

  removeItem(productId) {
    this.items.delete(String(productId));
    this.touch();
    return this;
  }

  clear() {
    this.items.clear();
    this.discounts = [];
    this.touch();
    return this;
  }

  applyDiscount(discount) {
    const d = { code: String(discount.code), type: discount.type, value: Number(discount.value) };
    if (!d.code) throw new Error('discount code required');
    if (!['percent', 'amount'].includes(d.type)) throw new Error('invalid discount type');
    if (!Number.isFinite(d.value) || d.value < 0) throw new Error('invalid discount value');
    if (this.discounts.some((x) => x.code === d.code)) throw new Error('discount already applied');
    this.discounts.push(d);
    this.touch();
    return this;
  }

  removeDiscount(code) {
    this.discounts = this.discounts.filter((d) => d.code !== String(code));
    this.touch();
    return this;
  }

  get subtotal() {
    let s = 0;
    for (const item of this.items.values()) s += item.total();
    return round(s);
  }

  get discountTotal() {
    const sub = this.subtotal;
    let d = 0;
    for (const disc of this.discounts) {
      if (disc.type === 'percent') d += sub * (disc.value / 100);
      else d += disc.value;
    }
    return round(Math.min(d, sub));
  }

  get tax() { return round((this.subtotal - this.discountTotal) * this.taxRate); }
  get total() { return round(this.subtotal - this.discountTotal + this.tax); }
  get itemCount() { let n = 0; for (const i of this.items.values()) n += i.quantity; return n; }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      currency: this.currency,
      taxRate: this.taxRate,
      items: [...this.items.values()].map((i) => i.toJSON()),
      discounts: [...this.discounts],
      subtotal: this.subtotal,
      discountTotal: this.discountTotal,
      tax: this.tax,
      total: this.total,
      itemCount: this.itemCount,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

function round(n) { return Math.round(n * 100) / 100; }

module.exports = { Cart, CartItem, round };
