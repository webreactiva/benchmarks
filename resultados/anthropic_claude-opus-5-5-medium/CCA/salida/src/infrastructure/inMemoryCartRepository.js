// Repositorio en memoria. Útil para desarrollo, tests y despliegues de una sola
// instancia. Para escalar horizontalmente usa RedisCartRepository (misma interfaz).
//
// Puerto CartRepository:
//   get(id)                         -> Promise<Cart|null>
//   save(cart, expectedVersion)     -> Promise<Cart>  (version = expectedVersion + 1)
//                                      lanza ConcurrencyError si la versión no coincide
//   delete(id)                      -> Promise<boolean>

import { ConcurrencyError } from '../domain/errors.js';

export class InMemoryCartRepository {
  /** @param {{ ttlMs?: number, now?: () => number }} opts */
  constructor({ ttlMs = 30 * 24 * 3600 * 1000, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.store = new Map(); // id -> { json, expiresAt }
  }

  async get(id) {
    const entry = this.liveEntry(id);
    // Se guarda serializado para que nadie pueda mutar el estado por referencia.
    return entry ? JSON.parse(entry.json) : null;
  }

  liveEntry(id) {
    const entry = this.store.get(id);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(id);
      return null;
    }
    return entry;
  }

  async save(cart, expectedVersion) {
    // Comprobación y escritura SIN ningún await en medio: así el compare-and-set
    // es atómico respecto a otras peticiones del mismo proceso.
    const currentVersion = this.liveEntry(cart.id)?.version ?? 0;
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError(cart.id, expectedVersion, currentVersion);
    }
    const saved = { ...cart, version: expectedVersion + 1 };
    this.store.set(cart.id, { json: JSON.stringify(saved), version: saved.version, expiresAt: this.now() + this.ttlMs });
    return saved;
  }

  async delete(id) {
    return this.store.delete(id);
  }

  /** Limpieza periódica de carritos abandonados (en Redis lo hace el TTL nativo). */
  sweep() {
    const now = this.now();
    for (const [id, e] of this.store) if (e.expiresAt <= now) this.store.delete(id);
  }
}
