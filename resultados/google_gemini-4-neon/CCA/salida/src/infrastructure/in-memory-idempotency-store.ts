import { createHash } from "node:crypto";
import { IdempotencyConflictError } from "../domain/errors.ts";
import type { IdempotencyRecord, IdempotencyStore } from "../ports/idempotency-store.ts";

interface InFlightEntry {
  requestHash: string;
  promise: Promise<unknown>;
}

/**
 * In-memory IdempotencyStore supporting:
 * 1. Replay of completed results within TTL.
 * 2. In-flight deduplication for concurrent retries with the same key.
 * 3. Payload mismatch rejection if the same key is reused with different parameters.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly completed = new Map<string, IdempotencyRecord>();
  private readonly inFlight = new Map<string, InFlightEntry>();

  async execute<TResult>(
    key: string,
    requestFingerprint: string,
    ttlMs: number,
    operation: () => Promise<TResult>,
  ): Promise<{ result: TResult; replayed: boolean }> {
    this.evictExpired();

    const requestHash = createHash("sha256").update(requestFingerprint).digest("hex");

    const cached = this.completed.get(key);
    if (cached) {
      if (cached.requestHash !== requestHash) {
        throw new IdempotencyConflictError(key, "Key was already used with a different request payload");
      }
      return { result: structuredClone(cached.result) as TResult, replayed: true };
    }

    const active = this.inFlight.get(key);
    if (active) {
      if (active.requestHash !== requestHash) {
        throw new IdempotencyConflictError(
          key,
          "Concurrent request uses the same key with a different payload",
        );
      }
      const result = (await active.promise) as TResult;
      return { result: structuredClone(result), replayed: true };
    }

    const promise = operation();
    this.inFlight.set(key, { requestHash, promise });

    try {
      const result = await promise;
      const now = Date.now();
      this.completed.set(key, {
        key,
        requestHash,
        result: structuredClone(result),
        createdAt: now,
        expiresAt: now + ttlMs,
      });
      return { result, replayed: false };
    } finally {
      this.inFlight.delete(key);
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.completed.entries()) {
      if (record.expiresAt <= now) {
        this.completed.delete(key);
      }
    }
  }
}
