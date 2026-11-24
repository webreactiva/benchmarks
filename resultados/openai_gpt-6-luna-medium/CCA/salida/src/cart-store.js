const STORAGE_KEY = 'nido-cart-v1';

/** Small observable cart store. UI can be replaced without changing cart rules. */
export class CartStore {
  #items = new Map();
  #listeners = new Set();

  constructor(products) {
    this.products = new Map(products.map((product) => [product.id, product]));
    this.#restore();
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    listener(this.snapshot());
    return () => this.#listeners.delete(listener);
  }

  snapshot() {
    const items = [...this.#items].map(([id, quantity]) => ({ product: this.products.get(id), quantity })).filter((item) => item.product);
    return { items, count: items.reduce((sum, item) => sum + item.quantity, 0), subtotal: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) };
  }

  add(id, amount = 1) {
    if (!this.products.has(id) || !Number.isInteger(amount) || amount < 1) return;
    this.#items.set(id, (this.#items.get(id) || 0) + amount);
    this.#publish();
  }

  setQuantity(id, quantity) {
    if (!this.products.has(id) || !Number.isInteger(quantity)) return;
    if (quantity < 1) this.#items.delete(id);
    else this.#items.set(id, quantity);
    this.#publish();
  }

  remove(id) {
    if (this.#items.delete(id)) this.#publish();
  }

  clear() { this.#items.clear(); this.#publish(); }

  #restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      for (const [id, quantity] of Object.entries(saved)) {
        if (this.products.has(id) && Number.isInteger(quantity) && quantity > 0) this.#items.set(id, quantity);
      }
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }

  #publish() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.#items))); } catch { /* Storage may be disabled; in-memory cart still works. */ }
    const state = this.snapshot();
    this.#listeners.forEach((listener) => listener(state));
  }
}
