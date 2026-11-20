import type {
  IdempotencyClaim,
  IdempotencyRecord,
  IdempotencyStore,
} from '../../application/ports.js';

interface Stored extends IdempotencyRecord {
  expiresAt: number;
}

/**
 * In-memory idempotency store. The Redis adapter guarantees the same
 * semantics across replicas.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, Stored>();

  async get(key: string): Promise<IdempotencyRecord | null> {
    const record = this.records.get(key);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      this.records.delete(key);
      return null;
    }
    return record;
  }

  async put(record: IdempotencyRecord, ttlSeconds: number): Promise<void> {
    this.records.set(record.key, { ...record, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async claim(key: string, requestHash: string, ttlSeconds: number): Promise<IdempotencyClaim> {
    const existing = this.records.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.requestHash === requestHash ? 'replay' : 'conflict';
    }
    this.records.set(key, {
      key,
      requestHash,
      statusCode: 0,
      body: null,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return 'claimed';
  }
}
