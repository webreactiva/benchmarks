// Adaptadores en memoria para los puertos secundarios. En producción cada uno se
// sustituye por su equivalente real sin tocar el servicio:
//   Catalog          -> microservicio de productos / BD (con caché)
//   CouponRepository -> BD de promociones
//   EventBus         -> Kafka, SNS/SQS, RabbitMQ, Redis Streams...
//   IdempotencyStore -> Redis (SET NX PX)

// ---- Catálogo ----------------------------------------------------------------
// Puerto: getMany(skus) -> Promise<Map<sku, { sku, name, price, stock, active }>>
export class InMemoryCatalog {
  constructor(products = []) {
    this.products = new Map(products.map((p) => [p.sku, { active: true, ...p }]));
  }
  async getMany(skus) {
    const out = new Map();
    for (const sku of skus) {
      const p = this.products.get(sku);
      if (p) out.set(sku, { ...p });
    }
    return out;
  }
  upsert(product) {
    this.products.set(product.sku, { active: true, ...product });
  }
}

// ---- Cupones -----------------------------------------------------------------
// Puerto: find(code) -> Promise<Rule|null>   (Rule: ver domain/pricing.js)
export class InMemoryCouponRepository {
  constructor(coupons = {}, { now = Date.now } = {}) {
    this.coupons = new Map(Object.entries(coupons).map(([k, v]) => [k.toUpperCase(), v]));
    this.now = now;
  }
  async find(code) {
    const c = this.coupons.get(code.toUpperCase());
    if (!c) return null;
    if (c.validUntil != null && c.validUntil < this.now()) return null;
    return { id: `coupon:${code.toUpperCase()}`, ...c };
  }
}

// ---- Bus de eventos ----------------------------------------------------------
// Puerto: publish(event) -> Promise<void>
export class InMemoryEventBus {
  constructor() {
    this.handlers = new Set();
    this.published = [];
  }
  subscribe(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  async publish(event) {
    this.published.push(event);
    for (const h of this.handlers) {
      try {
        await h(event);
      } catch (err) {
        // Un consumidor que falla no debe romper la petición del usuario.
        console.error('[eventBus] error en manejador', err);
      }
    }
  }
}

// ---- Idempotencia ------------------------------------------------------------
// Puerto: run(key, fn) -> Promise<result>
// Si llega dos veces la misma Idempotency-Key (reintento del cliente, doble clic)
// se devuelve el resultado de la primera ejecución en lugar de repetir la operación.
export class InMemoryIdempotencyStore {
  constructor({ ttlMs = 24 * 3600 * 1000, maxEntries = 100_000, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map(); // key -> { promise, expiresAt }
  }

  async run(key, fn) {
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > this.now()) return existing.promise;

    const promise = Promise.resolve().then(fn);
    this.entries.set(key, { promise, expiresAt: this.now() + this.ttlMs });
    // Los errores no se cachean: el cliente puede reintentar.
    promise.catch(() => this.entries.delete(key));
    this.evict();
    return promise;
  }

  evict() {
    if (this.entries.size <= this.maxEntries) return;
    const now = this.now();
    for (const [k, e] of this.entries) if (e.expiresAt <= now) this.entries.delete(k);
    // Si sigue lleno, descarta las más antiguas (Map conserva orden de inserción).
    for (const k of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(k);
    }
  }
}
