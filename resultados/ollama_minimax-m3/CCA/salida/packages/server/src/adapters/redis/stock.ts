import type { StockManager, StockRequest, StockReservation, IdGenerator, Logger } from '@cart/core';
import { InsufficientStockError } from '@cart/core';
import { RELEASE_STOCK_SCRIPT, RESERVE_STOCK_SCRIPT } from './scripts.js';
import type { RedisClient } from './connection.js';

export interface RedisStockManagerOptions {
  readonly keyPrefix: string;
  readonly reservationTtlSeconds: number;
  readonly ids: IdGenerator;
  readonly logger: Logger;
}

/**
 * Stock manager backed by Redis.
 *
 * All the stock keys share the `{stock}` hash tag so a multi product
 * reservation is atomic even on a Redis Cluster. In a system with a very hot
 * catalogue the tag can be replaced by a per seller tag, trading the global
 * atomicity of the basket for a better distribution of the load.
 */
export class RedisStockManager implements StockManager {
  private readonly prefix: string;

  constructor(
    private readonly redis: RedisClient,
    private readonly options: RedisStockManagerOptions,
  ) {
    this.prefix = options.keyPrefix;
  }

  private stockKey(productId: string): string {
    return `${this.prefix}stock:{stock}:${productId}`;
  }

  private reservationKey(reservationId: string): string {
    return `${this.prefix}stock:{stock}:resv:${reservationId}`;
  }

  async reserve(items: readonly StockRequest[]): Promise<StockReservation> {
    if (items.length === 0) {
      const reservationId = this.options.ids.next('resv');
      return { reservationId, items: [] };
    }

    const reservationId = this.options.ids.next('resv');
    const payload = JSON.stringify(items.map((item) => ({ ...item })));

    const result = (await this.redis.eval(RESERVE_STOCK_SCRIPT, {
      keys: [
        ...items.map((item) => this.stockKey(item.productId)),
        this.reservationKey(reservationId),
      ],
      arguments: [reservationId, String(this.options.reservationTtlSeconds), payload],
    })) as string[];

    if (result[0] === 'insufficient') {
      throw new InsufficientStockError(result[1] ?? 'unknown', 0, Number(result[2] ?? 0));
    }
    return { reservationId, items: [...items] };
  }

  async release(reservationId: string): Promise<void> {
    const payload = await this.redis.get(this.reservationKey(reservationId));
    if (!payload) return;
    const items = JSON.parse(payload) as StockRequest[];

    await this.redis.eval(RELEASE_STOCK_SCRIPT, {
      keys: [
        this.reservationKey(reservationId),
        ...items.map((item) => this.stockKey(item.productId)),
      ],
      arguments: [],
    });
  }

  async available(productId: string): Promise<number> {
    const raw = await this.redis.get(this.stockKey(productId));
    return raw === null ? 0 : Number(raw);
  }

  /** Seeds the stock levels (used by the bootstrap script and by the tests). */
  async seedStock(levels: Record<string, number>): Promise<void> {
    const entries = Object.entries(levels);
    if (entries.length === 0) return;
    await this.redis.mSet(
      Object.fromEntries(
        entries.map(([productId, quantity]) => [this.stockKey(productId), String(quantity)]),
      ),
    );
  }
}
