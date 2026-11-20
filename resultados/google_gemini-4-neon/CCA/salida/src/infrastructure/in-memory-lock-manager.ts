import { LockTimeoutError } from "../domain/errors.ts";
import type { LockManager } from "../ports/lock-manager.ts";

/**
 * Per-key asynchronous mutex implementing LockManager.
 * Serializes concurrent mutations on the *same* cart while allowing
 * thousands of *different* carts to execute completely in parallel.
 */
export class InMemoryLockManager implements LockManager {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly defaultTimeoutMs: number;

  constructor(options: { defaultTimeoutMs?: number } = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5000;
  }

  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const previous = this.queues.get(key) ?? Promise.resolve();

    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    const tail = previous.then(() => current);
    this.queues.set(key, tail);

    let acquired = false;
    try {
      await this.waitWithTimeout(previous, key, timeoutMs);
      acquired = true;
      return await fn();
    } finally {
      release();
      if (this.queues.get(key) === tail) {
        this.queues.delete(key);
      }
      if (!acquired) {
        // Ensure chain does not leak rejection if timed out before previous resolved
        void previous.catch(() => {});
      }
    }
  }

  private async waitWithTimeout(promise: Promise<void>, key: string, timeoutMs: number): Promise<void> {
    let timer: unknown;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new LockTimeoutError(key, timeoutMs));
      }, timeoutMs);
    });

    try {
      await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }
}
