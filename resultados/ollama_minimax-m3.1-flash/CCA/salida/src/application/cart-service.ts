import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config.js';
import type { Cart, CartItem, CartMutation } from '../domain/cart.js';
import type { Catalog } from '../domain/catalog.js';
import { computeLineId } from '../domain/catalog.js';
import type { Currency } from '../domain/money.js';
import {
  CartLimitExceededError,
  CartNotFoundError,
  CartVersionConflictError,
  DomainError,
  ForbiddenError,
  InvalidPayloadError,
  OutOfStockError,
  ProductInactiveError,
  ProductNotFoundError,
  PromoNotApplicableError,
  PromoNotFoundError,
  UnauthorizedError,
} from '../domain/errors.js';
import type { CartRepository, Clock, EventPublisher, EventTemplate } from '../domain/ports.js';
import { systemClock } from '../domain/ports.js';
import { newEventId } from '../domain/ids.js';
import type { LruCache } from '../infrastructure/lru-cache.js';

export interface Actor {
  userId: string | null;
  sessionId: string | null;
}

export interface AddItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface CartServiceDeps {
  repository: CartRepository;
  catalog: Catalog;
  publisher: EventPublisher;
  config: AppConfig;
  clock?: Clock;
  cache?: LruCache<Cart>;
  logger?: {
    info: (obj: unknown, msg?: string) => void;
    warn: (obj: unknown, msg?: string) => void;
    debug: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
  };
}

/**
 * Casos de uso del carrito.
 *
 * Reglas de negocio relevantes para la escalabilidad:
 * 1. El precio SIEMPRE se resuelve en el servidor a partir del catálogo; el
 *    cliente nunca envía importes.
 * 2. Toda mutación pasa por el repositorio atómico con control de
 *    concurrencia optimista; los conflictos devuelven 409 en lugar de
 *    sobrescribir el trabajo de otro usuario.
 * 3. Los eventos de dominio se escriben de forma transaccional junto al
 *    estado (outbox), lo que permite desacoplar analítica, pricing y
 *    notificaciones del camino crítico.
 */
export class CartService {
  private readonly repository: CartRepository;
  private readonly catalog: Catalog;
  private readonly publisher: EventPublisher;
  private readonly config: AppConfig;
  private readonly clock: Clock;
  private readonly cache: LruCache<Cart> | undefined;
  private readonly logger: CartServiceDeps['logger'];

  constructor(deps: CartServiceDeps) {
    this.repository = deps.repository;
    this.catalog = deps.catalog;
    this.publisher = deps.publisher;
    this.config = deps.config;
    this.clock = deps.clock ?? systemClock;
    this.cache = deps.cache;
    this.logger = deps.logger;
  }

  async createCart(actor: Actor, currency: Currency = 'EUR'): Promise<Cart> {
    if (actor.userId) {
      const active = await this.repository.findActiveByOwner(actor.userId);
      if (active.length >= this.config.cart.maxActivePerUser) {
        throw new CartLimitExceededError(this.config.cart.maxActivePerUser);
      }
    }

    const now = this.clock.now();
    const cart: Cart = {
      id: randomUUID(),
      ownerId: actor.userId,
      sessionId: actor.sessionId,
      currency,
      status: 'active',
      items: [],
      promoCodes: [],
      totals: {
        currency,
        subtotalCents: 0,
        discountCents: 0,
        promoCents: 0,
        shippingCents: 0,
        taxCents: 0,
        totalCents: 0,
        itemCount: 0,
      },
      version: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(
        now.getTime() + this.config.cart.ttlSeconds * 1000,
      ).toISOString(),
    };

    const created = await this.repository.create(
      cart,
      this.event('cart.created', actor, { currency }),
    );
    this.logger?.info({ cartId: created.id, ownerId: created.ownerId }, 'carrito creado');
    return created;
  }

  async getCart(cartId: string, actor: Actor): Promise<Cart> {
    const cached = this.cache?.get(cartId);
    if (cached) {
      this.assertAccess(cached, actor);
      return cached;
    }
    const cart = await this.repository.get(cartId);
    if (!cart) throw new CartNotFoundError(cartId);
    this.assertAccess(cart, actor);
    this.cache?.set(cartId, cart);
    return cart;
  }

  async listCarts(actor: Actor): Promise<Cart[]> {
    if (!actor.userId) return [];
    const carts = await this.repository.findActiveByOwner(actor.userId);
    this.logger?.debug?.({ count: carts.length }, 'carritos del usuario');
    return carts;
  }

  async addItem(
    cartId: string,
    actor: Actor,
    input: AddItemInput,
    expectedVersion: number | null,
  ): Promise<Cart> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new InvalidPayloadError('La cantidad debe ser un entero mayor que 0', {
        quantity: input.quantity,
      });
    }
    if (input.quantity > this.config.cart.maxQuantityPerLine) {
      throw new DomainError(
        'INVALID_QUANTITY',
        `La cantidad máxima por línea es ${this.config.cart.maxQuantityPerLine}`,
        400,
        { quantity: input.quantity, max: this.config.cart.maxQuantityPerLine },
      );
    }

    const current = await this.repository.get(cartId);
    if (!current) throw new CartNotFoundError(cartId);
    this.assertAccess(current, actor);

    const product = await this.catalog.getProduct({
      productId: input.productId,
      variantId: input.variantId ?? null,
    });
    if (!product) throw new ProductNotFoundError(input.productId);
    if (!product.active) throw new ProductInactiveError(input.productId);

    const existing = current.items.find(
      (item) => item.productId === product.productId && item.variantId === product.variantId,
    );
    const requestedTotal = (existing?.quantity ?? 0) + input.quantity;
    if (product.stock < requestedTotal) {
      throw new OutOfStockError(product.sku, requestedTotal, product.stock);
    }

    const item: CartItem = {
      lineId: computeLineId(product.productId, product.variantId),
      productId: product.productId,
      variantId: product.variantId,
      sku: product.sku,
      name: product.name,
      unitPriceCents: product.unitPriceCents,
      quantity: input.quantity,
      discountBps: 0,
      discountCents: 0,
      promoCents: 0,
      lineTotalCents: 0,
      volumeBreaks: product.volumeBreaks,
      metadata: product.metadata,
    };

    return this.applyMutation(
      cartId,
      expectedVersion,
      { kind: 'add_item', item },
      this.event('cart.item_added', actor, {
        productId: product.productId,
        variantId: product.variantId,
        quantity: input.quantity,
      }),
    );
  }

  async setQuantity(
    cartId: string,
    actor: Actor,
    lineId: string,
    quantity: number,
    expectedVersion: number | null,
  ): Promise<Cart> {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new InvalidPayloadError('La cantidad debe ser un entero mayor o igual que 0', {
        quantity,
      });
    }
    const current = await this.repository.get(cartId);
    if (!current) throw new CartNotFoundError(cartId);
    this.assertAccess(current, actor);

    if (quantity > 0) {
      const line = current.items.find((item) => item.lineId === lineId);
      if (line) {
        const product = await this.catalog.getProduct({
          productId: line.productId,
          variantId: line.variantId,
        });
        if (product && product.stock < quantity) {
          throw new OutOfStockError(line.sku, quantity, product.stock);
        }
      }
    }

    return this.applyMutation(
      cartId,
      expectedVersion,
      { kind: 'set_quantity', lineId, quantity },
      this.event('cart.item_updated', actor, { lineId, quantity }),
    );
  }

  async removeItem(
    cartId: string,
    actor: Actor,
    lineId: string,
    expectedVersion: number | null,
  ): Promise<Cart> {
    const current = await this.repository.get(cartId);
    if (!current) throw new CartNotFoundError(cartId);
    this.assertAccess(current, actor);

    return this.applyMutation(
      cartId,
      expectedVersion,
      { kind: 'remove_item', lineId },
      this.event('cart.item_removed', actor, { lineId }),
    );
  }

  async clear(cartId: string, actor: Actor, expectedVersion: number | null): Promise<Cart> {
    const current = await this.repository.get(cartId);
    if (!current) throw new CartNotFoundError(cartId);
    this.assertAccess(current, actor);

    return this.applyMutation(
      cartId,
      expectedVersion,
      { kind: 'clear' },
      this.event('cart.cleared', actor, {}),
    );
  }

  async applyPromo(
    cartId: string,
    actor: Actor,
    code: string,
    expectedVersion: number | null,
  ): Promise<Cart> {
    const rule = this.config.pricing.promos[code];
    if (!rule) throw new PromoNotFoundError(code);

    const current = await this.repository.get(cartId);
    if (!current) throw new CartNotFoundError(cartId);
    this.assertAccess(current, actor);

    const subtotal = current.totals.subtotalCents - current.totals.discountCents;
    if (rule.minSubtotalCents !== undefined && subtotal < rule.minSubtotalCents) {
      throw new PromoNotApplicableError(
        code,
        `requiere un subtotal mínimo de ${rule.minSubtotalCents} céntimos`,
      );
    }

    return this.applyMutation(
      cartId,
      expectedVersion,
      { kind: 'apply_promo', code },
      this.event('cart.promo_applied', actor, { code }),
    );
  }

  async removePromo(
    cartId: string,
    actor: Actor,
    code: string,
    expectedVersion: number | null,
  ): Promise<Cart> {
    const current = await this.repository.get(cartId);
    if (!current) throw new CartNotFoundError(cartId);
    this.assertAccess(current, actor);

    return this.applyMutation(
      cartId,
      expectedVersion,
      { kind: 'remove_promo', code },
      this.event('cart.promo_removed', actor, { code }),
    );
  }

  /**
   * Fusiona el carrito de invitado en el carrito del usuario (login).
   * Ambas operaciones son atómicas: si dos sesiones inician sesión a la vez
   * sobre el mismo carrito de destino, una gana y la otra recibe un conflicto.
   */
  async mergeCarts(
    targetCartId: string,
    sourceCartId: string,
    actor: Actor,
    expectedVersion: number | null,
  ): Promise<Cart> {
    if (targetCartId === sourceCartId) {
      throw new InvalidPayloadError('El carrito origen y destino son el mismo');
    }
    const source = await this.repository.get(sourceCartId);
    if (!source) throw new CartNotFoundError(sourceCartId);
    this.assertAccess(source, actor);

    const target = await this.repository.get(targetCartId);
    if (!target) throw new CartNotFoundError(targetCartId);
    this.assertAccess(target, actor);
    if (target.ownerId && actor.userId && target.ownerId !== actor.userId) {
      throw new ForbiddenError('El carrito destino pertenece a otro usuario');
    }

    return this.applyMerge(
      targetCartId,
      sourceCartId,
      expectedVersion,
      this.event('cart.merged', actor, { sourceCartId }),
    );
  }

  async checkout(cartId: string, actor: Actor, expectedVersion: number | null): Promise<Cart> {
    const current = await this.repository.get(cartId);
    if (!current) throw new CartNotFoundError(cartId);
    this.assertAccess(current, actor);
    if (current.items.length === 0) {
      throw new InvalidPayloadError('El carrito está vacío');
    }

    // Validación de stock contra el catálogo (fuera del camino crítico, pero
    // obligatoria antes de cerrar la venta).
    for (const item of current.items) {
      const product = await this.catalog.getProduct({
        productId: item.productId,
        variantId: item.variantId,
      });
      if (!product) throw new ProductNotFoundError(item.productId);
      if (!product.active) throw new ProductInactiveError(item.productId);
      if (product.stock < item.quantity) {
        throw new OutOfStockError(item.sku, item.quantity, product.stock);
      }
    }

    return this.applyMutation(
      cartId,
      expectedVersion,
      { kind: 'checkout' },
      this.event('cart.checked_out', actor, {
        totalCents: current.totals.totalCents,
        itemCount: current.totals.itemCount,
      }),
    );
  }

  /** Evento analítico sin efecto sobre el estado (no usa el outbox). */
  async trackView(cartId: string, actor: Actor): Promise<void> {
    if (!this.config.trackViews) return;
    void this.publisher
      .publish({
        id: newEventId(),
        type: 'cart.viewed',
        occurredAt: this.clock.now().toISOString(),
        cartId,
        version: 0,
        actorId: actor.userId,
        payload: {},
      })
      .catch((err: unknown) => {
        this.logger?.warn({ err }, 'no se pudo publicar cart.viewed');
      });
  }

  private async applyMutation(
    cartId: string,
    expectedVersion: number | null,
    mutation: CartMutation,
    event: EventTemplate,
  ): Promise<Cart> {
    const outcome = await this.repository.mutate(cartId, expectedVersion, mutation, event);
    return this.toCart(cartId, expectedVersion, outcome);
  }

  private async applyMerge(
    targetCartId: string,
    sourceCartId: string,
    expectedVersion: number | null,
    event: EventTemplate,
  ): Promise<Cart> {
    const outcome = await this.repository.merge(
      targetCartId,
      sourceCartId,
      expectedVersion,
      event,
    );
    if (outcome.status === 'not_found') {
      throw new CartNotFoundError(sourceCartId);
    }
    this.cache?.delete(sourceCartId);
    return this.toCart(targetCartId, expectedVersion, outcome);
  }

  private toCart(
    cartId: string,
    expectedVersion: number | null,
    outcome: Awaited<ReturnType<CartRepository['mutate']>>,
  ): Cart {
    switch (outcome.status) {
      case 'ok':
        this.cache?.delete(cartId);
        return outcome.cart;
      case 'not_found':
        throw new CartNotFoundError(cartId);
      case 'conflict':
        throw new CartVersionConflictError(
          cartId,
          expectedVersion ?? -1,
          outcome.current.version,
        );
      case 'invalid':
        throw this.mapInvalid(outcome.code);
    }
  }

  private mapInvalid(code: string): DomainError {
    switch (code) {
      case 'INVALID_QUANTITY':
        return new DomainError(
          'INVALID_QUANTITY',
          `Cantidad inválida (máximo ${this.config.cart.maxQuantityPerLine} por línea)`,
          400,
          { max: this.config.cart.maxQuantityPerLine },
        );
      case 'CART_LIMIT_EXCEEDED':
        return new CartLimitExceededError(this.config.cart.maxItems);
      case 'CART_LINE_NOT_FOUND':
        return new DomainError('CART_LINE_NOT_FOUND', 'La línea del carrito no existe', 404);
      case 'PROMO_NOT_FOUND':
        return new DomainError('PROMO_NOT_FOUND', 'El código promocional no existe', 404);
      case 'CART_ALREADY_CHECKED_OUT':
        return new DomainError(
          'CART_ALREADY_CHECKED_OUT',
          'El carrito ya está finalizado',
          409,
        );
      default:
        return new DomainError('INVALID_PAYLOAD', `Operación no válida: ${code}`, 400, { code });
    }
  }

  private assertAccess(cart: Cart, actor: Actor): void {
    if (cart.ownerId) {
      if (!actor.userId) throw new UnauthorizedError();
      if (cart.ownerId !== actor.userId) throw new ForbiddenError();
      return;
    }
    if (cart.sessionId) {
      if (!actor.sessionId) throw new UnauthorizedError();
      if (cart.sessionId !== actor.sessionId) throw new ForbiddenError();
    }
  }

  private event(type: string, actor: Actor, payload: Record<string, unknown>): EventTemplate {
    return {
      id: newEventId(),
      type,
      occurredAt: this.clock.now().toISOString(),
      actorId: actor.userId ?? actor.sessionId,
      payload,
    };
  }
}
