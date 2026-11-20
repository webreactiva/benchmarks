import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type Redis from 'ioredis';
import type { AppConfig } from '../config.js';
import type { Cart, CartMutation, MutationOutcome } from '../domain/cart.js';
import type { CartRepository, Clock, EventTemplate } from '../domain/ports.js';
import { systemClock } from '../domain/ports.js';
import { normalizeCart, serializeMutation } from './cart-json.js';

const cartLua = readFileSync(fileURLToPath(new URL('./lua/cart.lua', import.meta.url)), 'utf8');
const mergeLua = readFileSync(fileURLToPath(new URL('./lua/merge.lua', import.meta.url)), 'utf8');

/**
 * Repositorio de carritos sobre Redis.
 *
 * - Toda mutación se ejecuta dentro de un script Lua (atomicidad y ausencia de
 *   lost updates entre instancias concurrentes).
 * - El versionado optimista (`expectedVersion`) permite detectar el conflicto
 *   en lugar de sobrescribir silenciosamente el trabajo de otro usuario.
 * - El estado vive fuera del proceso: las instancias de API son stateless y
 *   se pueden escalar horizontalmente sin afinidad de sesión.
 * - La mutación y el evento de dominio se escriben en el mismo script
 *   (patrón outbox transaccional): nunca hay estado sin evento ni evento sin
 *   estado.
 */
export class RedisCartRepository implements CartRepository {
  private readonly redis: Redis;
  private readonly config: AppConfig;
  private readonly clock: Clock;

  constructor(redis: Redis, config: AppConfig, clock: Clock = systemClock) {
    this.redis = redis;
    this.config = config;
    this.clock = clock;

    this.redis.defineCommand('cartMutate', { numberOfKeys: 2, lua: cartLua });
    this.redis.defineCommand('cartMerge', { numberOfKeys: 3, lua: mergeLua });
  }

  private cartKey(cartId: string): string {
    return `cart:${cartId}`;
  }

  private ownerKey(ownerId: string): string {
    return `owner:${ownerId}`;
  }

  private get streamKey(): string {
    return 'events:cart';
  }

  async create(cart: Cart, event?: EventTemplate): Promise<Cart> {
    const now = this.clock.now();
    const result = (await this.redis.cartMutate(
      this.cartKey(cart.id),
      this.streamKey,
      'create',
      JSON.stringify(cart),
      -1,
      JSON.stringify(this.config.pricing),
      now.toISOString(),
      this.expiresAt(now).toISOString(),
      this.config.cart.ttlSeconds,
      this.eventJson(event),
      this.config.events.streamMaxLen,
    )) as [string, string, string];

    if (result[0] !== 'ok') {
      throw new Error(`No se pudo crear el carrito ${cart.id}: ${result[2] || result[0]}`);
    }

    if (cart.ownerId) {
      await this.redis.zadd(
        this.ownerKey(cart.ownerId),
        this.expiresAtEpoch(this.expiresAt(now).toISOString()),
        cart.id,
      );
    }

    return normalizeCart(JSON.parse(result[2]));
  }

  async get(cartId: string): Promise<Cart | null> {
    const raw = await this.redis.get(this.cartKey(cartId));
    if (!raw) return null;
    try {
      return normalizeCart(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async mutate(
    cartId: string,
    expectedVersion: number | null,
    mutation: CartMutation,
    event?: EventTemplate,
  ): Promise<MutationOutcome> {
    const { op, payload } = serializeMutation(mutation);
    const now = this.clock.now();
    const result = (await this.redis.cartMutate(
      this.cartKey(cartId),
      this.streamKey,
      op,
      JSON.stringify(payload),
      expectedVersion === null ? -1 : expectedVersion,
      JSON.stringify(this.config.pricing),
      now.toISOString(),
      this.expiresAt(now).toISOString(),
      this.config.cart.ttlSeconds,
      this.eventJson(event),
      this.config.events.streamMaxLen,
    )) as [string, string, string];

    return this.toOutcome(result);
  }

  async merge(
    targetCartId: string,
    sourceCartId: string,
    expectedVersion: number | null,
    event?: EventTemplate,
  ): Promise<MutationOutcome> {
    const now = this.clock.now();
    const result = (await this.redis.cartMerge(
      this.cartKey(targetCartId),
      this.cartKey(sourceCartId),
      this.streamKey,
      expectedVersion === null ? -1 : expectedVersion,
      JSON.stringify(this.config.pricing),
      now.toISOString(),
      this.expiresAt(now).toISOString(),
      this.config.cart.ttlSeconds,
      this.eventJson(event),
      this.config.events.streamMaxLen,
    )) as [string, string, string];

    if (result[0] === 'source_not_found') {
      return { status: 'not_found' };
    }
    return this.toOutcome(result);
  }

  async remove(cartId: string): Promise<void> {
    const cart = await this.get(cartId);
    await this.redis.del(this.cartKey(cartId));
    if (cart?.ownerId) {
      await this.redis.zrem(this.ownerKey(cart.ownerId), cartId);
    }
  }

  async findActiveByOwner(ownerId: string): Promise<Cart[]> {
    const key = this.ownerKey(ownerId);
    const nowEpoch = Math.floor(this.clock.now().getTime() / 1000);
    const ids = await this.redis.zrangebyscore(key, nowEpoch, '+inf');
    if (ids.length === 0) return [];
    const raws = await this.redis.mget(ids.map((id) => this.cartKey(id)));
    const carts: Cart[] = [];
    for (const raw of raws) {
      if (!raw) continue;
      try {
        carts.push(normalizeCart(JSON.parse(raw)));
      } catch {
        // registro corrupto: se ignora
      }
    }
    await this.redis.zremrangebyscore(key, '-inf', nowEpoch);
    return carts;
  }

  private eventJson(event?: EventTemplate): string {
    if (!event) return '';
    return JSON.stringify({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      actorId: event.actorId,
      payload: event.payload,
    });
  }

  private toOutcome(result: [string, string, string]): MutationOutcome {
    const [status, version, payload] = result;
    switch (status) {
      case 'ok':
        return { status: 'ok', cart: normalizeCart(JSON.parse(payload)) };
      case 'not_found':
        return { status: 'not_found' };
      case 'conflict':
        return { status: 'conflict', current: normalizeCart(JSON.parse(payload)) };
      case 'invalid':
        return { status: 'invalid', code: payload, message: `Invalid cart operation: ${payload}` };
      default:
        throw new Error(`Resultado inesperado del script de carrito: ${status} (${version})`);
    }
  }

  private expiresAt(now: Date): Date {
    return new Date(now.getTime() + this.config.cart.ttlSeconds * 1000);
  }

  private expiresAtEpoch(iso: string): number {
    const parsed = Date.parse(iso);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
  }
}
