const { InMemoryCartRepository } = require('./persistence/memoryStore');
const { Cart } = require('./cart');
const { LockManager } = require('./locking');
const { EventBus } = require('./events');

class CartManager {
  constructor(opts = {}) {
    this.repo = opts.repository || new InMemoryCartRepository();
    this.inventory = opts.inventory || null;
    this.locks = opts.lockManager || new LockManager();
    this.events = opts.events || new EventBus();
    this.coupons = opts.coupons || new Map();
    this.maxItems = opts.maxItems || 100;
    this.maxQuantityPerItem = opts.maxQuantityPerItem || 999;
  }

  _run(cartId, fn) { return this.locks.run(String(cartId), fn); }

  async createCart({ userId, currency, taxRate } = {}) {
    const cart = new Cart({ userId, currency, taxRate });
    await this.repo.create(cart);
    this.events.emit('cart.created', { cartId: cart.id, userId });
    return cart;
  }

  async getCart(id) {
    const cart = await this.repo.findById(id);
    if (!cart) throw new Error('cart not found');
    return cart;
  }

  async addItem(cartId, item) {
    return this._run(cartId, async () => {
      const cart = await this.getCart(cartId);
      if (cart.items.size >= this.maxItems && !cart.items.has(String(item.productId))) {
        throw new Error('cart full');
      }
      if (this.inventory) await this.inventory.check(item.productId, item.quantity || 1);
      const existing = cart.items.get(String(item.productId));
      const newQty = (existing ? existing.quantity : 0) + (item.quantity || 1);
      if (newQty > this.maxQuantityPerItem) throw new Error('quantity limit exceeded');
      cart.addItem(item);
      await this.repo.save(cart);
      this.events.emit('cart.item.added', { cartId, productId: item.productId, quantity: item.quantity || 1 });
      return cart;
    });
  }

  async updateQuantity(cartId, productId, quantity) {
    return this._run(cartId, async () => {
      const cart = await this.getCart(cartId);
      cart.updateQuantity(productId, quantity);
      await this.repo.save(cart);
      this.events.emit('cart.item.updated', { cartId, productId, quantity });
      return cart;
    });
  }

  async removeItem(cartId, productId) {
    return this._run(cartId, async () => {
      const cart = await this.getCart(cartId);
      cart.removeItem(productId);
      await this.repo.save(cart);
      this.events.emit('cart.item.removed', { cartId, productId });
      return cart;
    });
  }

  async clear(cartId) {
    return this._run(cartId, async () => {
      const cart = await this.getCart(cartId);
      cart.clear();
      await this.repo.save(cart);
      this.events.emit('cart.cleared', { cartId });
      return cart;
    });
  }

  async applyCoupon(cartId, code) {
    return this._run(cartId, async () => {
      const cart = await this.getCart(cartId);
      const discount = this.coupons.get(String(code));
      if (!discount) throw new Error('unknown coupon');
      cart.applyDiscount(discount);
      await this.repo.save(cart);
      this.events.emit('cart.discount.applied', { cartId, code });
      return cart;
    });
  }

  registerCoupon(code, discount) { this.coupons.set(String(code), { code, ...discount }); return this; }
}
module.exports = { CartManager };
