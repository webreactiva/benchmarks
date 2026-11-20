/**
 * Caché local (LRU + TTL) para lecturas de carrito.
 *
 * Reduce la presión sobre Redis en los hottest paths (el `GET` de un carrito es
 * la operación más frecuente de un e-commerce). La invalidación se hace por
 * escritura: cualquier mutación en esta instancia borra su entrada local y,
 * como el TTL es corto, las demás instancias convergen en milisegundos.
 */
export class LruCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries: number, ttlMs: number) {
    this.maxEntries = Math.max(1, maxEntries);
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // refresca la recencia (LRU)
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.ttlMs <= 0) return;
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
