import type { AppConfig } from '../config.js';
import type { Cart, CartItem, CartMutation, MutationOutcome } from '../domain/cart.js';
import { computeTotals, proratePromo } from '../domain/pricing.js';
import type { CartRepository, Clock, EventTemplate } from '../domain/ports.js';
import { systemClock } from '../domain/ports.js';
import { resolveVolumeBreak } from '../domain/catalog.js';

/**
 * Repositorio en memoria. Se usa como degradación elegante cuando Redis no
 * está disponible y en las pruebas unitarias. Mantiene la misma semántica que
 * el script Lua (incluido el versionado optimista) serializando las
 * operaciones por carrito mediante una cola de promesas.
 */
export class MemoryCartRepository implements CartRepository {
  private readonly carts = new Map<string, Cart>();
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly config: AppConfig;
  private readonly clock: Clock;

  constructor(config: AppConfig, clock: Clock = systemClock) {
    this.config = config;
    this.clock = clock;
  }

  async create(cart: Cart, _event?: EventTemplate): Promise<Cart> {
    const now = this.clock.now();
    const created: Cart = {
      ...cart,
      version: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: this.expiresAt(now).toISOString(),
    };
    this.reprice(created);
    this.carts.set(created.id, created);
    return structuredClone(created);
  }

  async get(cartId: string): Promise<Cart | null> {
    const cart = this.carts.get(cartId);
    return cart ? structuredClone(cart) : null;
  }

  async mutate(
    cartId: string,
    expectedVersion: number | null,
    mutation: CartMutation,
    _event?: EventTemplate,
  ): Promise<MutationOutcome> {
    return this.withLock(cartId, async () => {
      const cart = this.carts.get(cartId);
      if (!cart) return { status: 'not_found' };
      if (cart.status !== 'active') {
        return { status: 'invalid', code: 'CART_ALREADY_CHECKED_OUT', message: 'Carrito no activo' };
      }
      if (expectedVersion !== null && cart.version !== expectedVersion) {
        return { status: 'conflict', current: structuredClone(cart) };
      }

      const maxQty = this.config.cart.maxQuantityPerLine;
      const maxItems = this.config.cart.maxItems;

      switch (mutation.kind) {
        case 'add_item': {
          const item = mutation.item;
          if (item.quantity <= 0 || item.quantity > maxQty) {
            return { status: 'invalid', code: 'INVALID_QUANTITY', message: 'Cantidad inválida' };
          }
          const existing = cart.items.find((i) => i.lineId === item.lineId);
          if (existing) {
            const newQty = existing.quantity + item.quantity;
            if (newQty > maxQty) {
              return { status: 'invalid', code: 'INVALID_QUANTITY', message: 'Cantidad inválida' };
            }
            existing.quantity = newQty;
            existing.discountBps = resolveVolumeBreak(existing.volumeBreaks, newQty);
          } else {
            if (cart.items.length >= maxItems) {
              return {
                status: 'invalid',
                code: 'CART_LIMIT_EXCEEDED',
                message: 'Demasiadas líneas',
              };
            }
            cart.items.push({
              ...item,
              discountBps: resolveVolumeBreak(item.volumeBreaks, item.quantity),
              discountCents: 0,
              promoCents: 0,
              lineTotalCents: 0,
            });
          }
          break;
        }
        case 'set_quantity': {
          if (mutation.quantity < 0 || mutation.quantity > maxQty) {
            return { status: 'invalid', code: 'INVALID_QUANTITY', message: 'Cantidad inválida' };
          }
          const index = cart.items.findIndex((i) => i.lineId === mutation.lineId);
          if (index === -1) {
            return {
              status: 'invalid',
              code: 'CART_LINE_NOT_FOUND',
              message: 'Línea no encontrada',
            };
          }
          if (mutation.quantity === 0) {
            cart.items.splice(index, 1);
          } else {
            const item = cart.items[index]!;
            item.quantity = mutation.quantity;
            item.discountBps = resolveVolumeBreak(item.volumeBreaks, mutation.quantity);
          }
          break;
        }
        case 'remove_item': {
          const index = cart.items.findIndex((i) => i.lineId === mutation.lineId);
          if (index === -1) {
            return {
              status: 'invalid',
              code: 'CART_LINE_NOT_FOUND',
              message: 'Línea no encontrada',
            };
          }
          cart.items.splice(index, 1);
          break;
        }
        case 'clear':
          cart.items = [];
          cart.promoCodes = [];
          break;
        case 'apply_promo': {
          if (!this.config.pricing.promos[mutation.code]) {
            return {
              status: 'invalid',
              code: 'PROMO_NOT_FOUND',
              message: 'Cupón no encontrado',
            };
          }
          if (!cart.promoCodes.includes(mutation.code)) {
            cart.promoCodes.push(mutation.code);
          }
          break;
        }
        case 'remove_promo':
          cart.promoCodes = cart.promoCodes.filter((c) => c !== mutation.code);
          break;
        case 'checkout':
          cart.status = 'checked_out';
          break;
      }

      this.reprice(cart);
      cart.version += 1;
      cart.updatedAt = this.clock.now().toISOString();
      cart.expiresAt = this.expiresAt(this.clock.now()).toISOString();
      return { status: 'ok', cart: structuredClone(cart) };
    });
  }

  async merge(
    targetCartId: string,
    sourceCartId: string,
    expectedVersion: number | null,
    _event?: EventTemplate,
  ): Promise<MutationOutcome> {
    return this.withLock(targetCartId, async () => {
      const target = this.carts.get(targetCartId);
      if (!target) return { status: 'not_found' };
      if (target.status !== 'active') {
        return { status: 'invalid', code: 'CART_ALREADY_CHECKED_OUT', message: 'Carrito no activo' };
      }
      if (expectedVersion !== null && target.version !== expectedVersion) {
        return { status: 'conflict', current: structuredClone(target) };
      }
      const source = this.carts.get(sourceCartId);
      if (!source) return { status: 'not_found' };

      const maxQty = this.config.cart.maxQuantityPerLine;
      for (const srcItem of source.items) {
        const existing = target.items.find((i) => i.lineId === srcItem.lineId);
        if (existing) {
          existing.quantity = Math.min(maxQty, existing.quantity + srcItem.quantity);
          existing.discountBps = resolveVolumeBreak(existing.volumeBreaks, existing.quantity);
        } else if (target.items.length < this.config.cart.maxItems) {
          target.items.push({
            ...srcItem,
            discountBps: resolveVolumeBreak(srcItem.volumeBreaks, srcItem.quantity),
            discountCents: 0,
            promoCents: 0,
            lineTotalCents: 0,
          });
        }
      }
      for (const code of source.promoCodes) {
        if (!target.promoCodes.includes(code)) target.promoCodes.push(code);
      }

      this.reprice(target);
      target.version += 1;
      target.updatedAt = this.clock.now().toISOString();
      target.expiresAt = this.expiresAt(this.clock.now()).toISOString();
      this.carts.delete(sourceCartId);
      return { status: 'ok', cart: structuredClone(target) };
    });
  }

  async remove(cartId: string): Promise<void> {
    this.carts.delete(cartId);
  }

  async findActiveByOwner(ownerId: string): Promise<Cart[]> {
    const now = this.clock.now().getTime();
    return [...this.carts.values()]
      .filter((c) => c.ownerId === ownerId && c.status === 'active' && Date.parse(c.expiresAt) > now)
      .map((c) => structuredClone(c));
  }

  private reprice(cart: Cart): void {
    const totals = computeTotals({
      items: cart.items,
      promoCodes: cart.promoCodes,
      currency: cart.currency,
      shippingFlatCents: this.config.pricing.shippingFlatCents,
      freeShippingThresholdCents: this.config.pricing.freeShippingThresholdCents,
      taxBps: this.config.pricing.taxBps,
      promos: this.config.pricing.promos,
    });
    cart.totals = totals;
    cart.items = proratePromo(cart.items as CartItem[], totals);
  }

  private expiresAt(now: Date): Date {
    return new Date(now.getTime() + this.config.cart.ttlSeconds * 1000);
  }

  private async withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    const result = previous.then(fn, fn);
    this.locks.set(
      id,
      result.catch(() => undefined),
    );
    try {
      return await result;
    } finally {
      if (this.locks.get(id) === result) this.locks.delete(id);
    }
  }
}
