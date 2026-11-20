/**
 * Distributed Lock Manager Port (e.g., Redlock / Redis SET NX / Postgres advisory locks).
 * Coordinates concurrent mutations targeting the same cart key while keeping
 * different carts fully parallel.
 */
export interface LockManager {
  withLock<T>(key: string, fn: () => Promise<T>, options?: { timeoutMs?: number }): Promise<T>;
}
