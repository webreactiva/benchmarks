class CartRepository {
  async findById(id) { throw new Error('not implemented'); }
  async save(cart) { throw new Error('not implemented'); }
  async delete(id) { throw new Error('not implemented'); }
  async findByUser(userId) { throw new Error('not implemented'); }
  async create(cart) { throw new Error('not implemented'); }
}

class InMemoryCartRepository extends CartRepository {
  constructor() { super(); this.store = new Map(); }
  async findById(id) { return this.store.get(String(id)) || null; }
  async findByUser(userId) {
    return [...this.store.values()].filter((c) => c.userId === userId);
  }
  async create(cart) {
    const id = cart.id || `cart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cart.id = id;
    this.store.set(String(id), cart);
    return cart;
  }
  async save(cart) {
    const key = String(cart.id);
    const existing = this.store.get(key);
    if (existing && existing.version !== cart.version - 1 && existing.version !== cart.version) {
      throw new Error('conflict: stale cart version');
    }
    this.store.set(key, cart);
    return cart;
  }
  async delete(id) { this.store.delete(String(id)); }
}
module.exports = { CartRepository, InMemoryCartRepository };
