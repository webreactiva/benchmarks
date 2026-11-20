import type { Cache } from '../../application/ports.js';

interface Entry {
  value: unknown;
  expiresAt: number;
}

/** TTL cache with LRU-ish eviction, used when Redis is not configured. */
export class InMemoryCache implements Cache {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly maxEntries = 1000) {}

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
