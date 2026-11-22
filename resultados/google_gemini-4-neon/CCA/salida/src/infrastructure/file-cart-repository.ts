import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CartSnapshot } from "../domain/cart.ts";
import { ConcurrencyConflictError } from "../domain/errors.ts";
import type { CartRepository } from "../ports/cart-repository.ts";

interface PersistedData {
  carts: Record<string, CartSnapshot>;
}

/**
 * Durable JSON-file CartRepository using atomic temp-file + rename writes.
 * Preserves optimistic concurrency checks and survives process restarts without
 * requiring an external database server.
 */
export class FileCartRepository implements CartRepository {
  private readonly filePath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async findById(cartId: string): Promise<CartSnapshot | null> {
    const data = await this.readStore();
    const found = data.carts[cartId];
    return found ? structuredClone(found) : null;
  }

  async findActiveByOwner(ownerId: string): Promise<CartSnapshot | null> {
    const data = await this.readStore();
    let latest: CartSnapshot | null = null;
    for (const cart of Object.values(data.carts)) {
      if (cart.ownerId === ownerId && cart.status === "ACTIVE") {
        if (!latest || cart.updatedAt > latest.updatedAt) {
          latest = cart;
        }
      }
    }
    return latest ? structuredClone(latest) : null;
  }

  async save(snapshot: CartSnapshot, expectedVersion: number): Promise<void> {
    await this.enqueueWrite(async () => {
      const data = await this.readStore();
      const existing = data.carts[snapshot.id];
      const actualVersion = existing ? existing.version : 0;

      if (actualVersion !== expectedVersion) {
        throw new ConcurrencyConflictError(snapshot.id, expectedVersion, actualVersion);
      }

      data.carts[snapshot.id] = structuredClone(snapshot);
      await this.writeStore(data);
    });
  }

  async delete(cartId: string): Promise<boolean> {
    let deleted = false;
    await this.enqueueWrite(async () => {
      const data = await this.readStore();
      if (cartId in data.carts) {
        delete data.carts[cartId];
        deleted = true;
        await this.writeStore(data);
      }
    });
    return deleted;
  }

  async purgeExpired(now: Date): Promise<CartSnapshot[]> {
    const expired: CartSnapshot[] = [];
    await this.enqueueWrite(async () => {
      const data = await this.readStore();
      const nowMs = now.getTime();
      let changed = false;

      for (const [id, snapshot] of Object.entries(data.carts)) {
        if (snapshot.status === "ACTIVE" && new Date(snapshot.expiresAt).getTime() <= nowMs) {
          const updated: CartSnapshot = {
            ...structuredClone(snapshot),
            status: "EXPIRED",
            version: snapshot.version + 1,
            updatedAt: now.toISOString(),
          };
          data.carts[id] = updated;
          expired.push(structuredClone(updated));
          changed = true;
        }
      }

      if (changed) {
        await this.writeStore(data);
      }
    });
    return expired;
  }

  private async enqueueWrite(task: () => Promise<void>): Promise<void> {
    const previous = this.writeChain;
    let release!: () => void;
    this.writeChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      await task();
    } finally {
      release();
    }
  }

  private async readStore(): Promise<PersistedData> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<PersistedData>;
      return { carts: parsed.carts ?? {} };
    } catch {
      return { carts: {} };
    }
  }

  private async writeStore(data: PersistedData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    await rename(tmpPath, this.filePath);
  }
}
