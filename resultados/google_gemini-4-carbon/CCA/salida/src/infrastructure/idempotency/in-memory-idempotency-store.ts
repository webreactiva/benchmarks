import type { IdempotencyPort, IdempotencyRecord } from '../../application/ports.ts';
import { DomainError } from '../../domain/errors.ts';

interface StoredEntry {
  fingerprint: string;
  result: unknown;
  expiresAtMs: number;
}

interface InFlightEntry {
  fingerprint: string;
  promise: Promise<unknown>;
}

/**
 * Almacén de Idempotencia con deduplicación de peticiones en vuelo (Singleflight)
 * y verificación de huella (fingerprint) para evitar reutilizar una misma Idempotency-Key
 * con parámetros de negocio distintos.
 */
export class InMemoryIdempotencyStore implements IdempotencyPort {
  private readonly completed = new Map<string, StoredEntry>();
  private readonly inFlight = new Map<string, InFlightEntry>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(maxEntries = 10_000, defaultTtlMs = 24 * 60 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  async execute<T>(
    key: string,
    fingerprint: string,
    operation: () => Promise<T>,
    ttlMs = this.defaultTtlMs,
  ): Promise<IdempotencyRecord<T>> {
    const normalizedKey = key.trim();
    const now = Date.now();

    const cached = this.completed.get(normalizedKey);
    if (cached) {
      if (cached.expiresAtMs > now) {
        if (cached.fingerprint !== fingerprint) {
          throw new DomainError(
            'IDEMPOTENCY_CONFLICT',
            `La clave de idempotencia '${normalizedKey}' ya fue utilizada con un payload distinto.`,
            409,
          );
        }
        return {
          result: structuredClone(cached.result) as T,
          replayed: true,
        };
      }
      this.completed.delete(normalizedKey);
    }

    const active = this.inFlight.get(normalizedKey);
    if (active) {
      if (active.fingerprint !== fingerprint) {
        throw new DomainError(
          'IDEMPOTENCY_CONFLICT',
          `La clave de idempotencia '${normalizedKey}' está en curso con un payload distinto.`,
          409,
        );
      }
      const sharedResult = (await active.promise) as T;
      return {
        result: structuredClone(sharedResult),
        replayed: true,
      };
    }

    const executionPromise = operation();
    this.inFlight.set(normalizedKey, { fingerprint, promise: executionPromise });

    try {
      const result = await executionPromise;
      if (this.completed.size >= this.maxEntries) {
        const oldestKey = this.completed.keys().next().value;
        if (oldestKey !== undefined) {
          this.completed.delete(oldestKey);
        }
      }
      this.completed.set(normalizedKey, {
        fingerprint,
        result: structuredClone(result),
        expiresAtMs: Date.now() + ttlMs,
      });
      return { result, replayed: false };
    } finally {
      this.inFlight.delete(normalizedKey);
    }
  }
}
