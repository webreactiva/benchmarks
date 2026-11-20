class InMemoryInventory {
  constructor(stock = {}) {
    this.stock = new Map(Object.entries(stock).map(([k, v]) => [String(k), Number(v)]));
  }
  async getStock(productId) { return this.stock.has(String(productId)) ? this.stock.get(String(productId)) : Infinity; }
  async check(productId, quantity) {
    const available = await this.getStock(productId);
    if (available < quantity) throw new Error('insufficient stock');
    return true;
  }
  async reserve(productId, quantity) {
    const key = String(productId);
    const available = await this.getStock(key);
    if (available < quantity) throw new Error('insufficient stock');
    if (available !== Infinity) this.stock.set(key, available - quantity);
  }
}
module.exports = { InMemoryInventory };
