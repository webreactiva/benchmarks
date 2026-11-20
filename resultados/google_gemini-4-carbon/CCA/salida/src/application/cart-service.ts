import { randomUUID } from 'node:crypto';
import { Cart, type CartView } from '../domain/cart.ts';
import {
  ConcurrencyConflictError,
  DomainError,
  InsufficientStockError,
  NotFoundError,
} from '../domain/errors.ts';
import { Money, type CurrencyCode, type MoneyJSON } from '../domain/money.ts';
import { PricingEngine, type PricingBreakdownJSON } from '../domain/pricing.ts';
import type {
  CartRepository,
  CatalogInventoryPort,
  EventBusPort,
  IdempotencyPort,
} from './ports.ts';

export interface CreateOrGetCartCommand {
  userId?: string | null;
  sessionId?: string | null;
  currency?: CurrencyCode;
}

export interface AddCartItemCommand {
  cartId: string;
  sku: string;
  quantity: number;
  expectedVersion?: number;
}

export interface SetCartItemQuantityCommand {
  cartId: string;
  sku: string;
  quantity: number;
  expectedVersion?: number;
}

export interface RemoveCartItemCommand {
  cartId: string;
  sku: string;
  expectedVersion?: number;
}

export interface ApplyCouponCommand {
  cartId: string;
  couponCode: string;
  expectedVersion?: number;
}

export interface MergeCartsCommand {
  guestCartId: string;
  userId: string;
  currency?: CurrencyCode;
}

export interface CheckoutCartCommand {
  cartId: string;
  customerEmail?: string;
  shippingAddress?: string;
  expectedVersion?: number;
}

export interface PriceAdjustmentNotice {
  sku: string;
  previousUnitPrice: MoneyJSON;
  currentUnitPrice: MoneyJSON;
}

export interface OrderSnapshot {
  orderId: string;
  cartId: string;
  userId: string | null;
  sessionId: string | null;
  customerEmail: string | null;
  shippingAddress: string | null;
  reservationId: string;
  items: CartView['items'];
  pricing: PricingBreakdownJSON;
  priceAdjustments: PriceAdjustmentNotice[];
  createdAt: string;
}

export interface CheckoutResult {
  order: OrderSnapshot;
  cart: CartView;
}

export interface CartServiceDeps {
  cartRepository: CartRepository;
  catalogInventory: CatalogInventoryPort;
  pricingEngine: PricingEngine;
  eventBus: EventBusPort;
  idempotencyStore: IdempotencyPort;
  maxAutoRetries?: number;
}

export class CartService {
  private readonly repo: CartRepository;
  private readonly catalog: CatalogInventoryPort;
  private readonly pricing: PricingEngine;
  private readonly eventBus: EventBusPort;
  private readonly idempotency: IdempotencyPort;
  private readonly maxAutoRetries: number;
  private readonly cartLocks = new Map<string, Promise<void>>();

  constructor(deps: CartServiceDeps) {
    this.repo = deps.cartRepository;
    this.catalog = deps.catalogInventory;
    this.pricing = deps.pricingEngine;
    this.eventBus = deps.eventBus;
    this.idempotency = deps.idempotencyStore;
    this.maxAutoRetries = deps.maxAutoRetries ?? 8;
  }

  async runIdempotent<T>(
    idempotencyKey: string | undefined,
    fingerprint: string,
    operation: () => Promise<T>,
  ): Promise<{ result: T; replayed: boolean }> {
    if (!idempotencyKey) {
      return { result: await operation(), replayed: false };
    }
    return this.idempotency.execute(idempotencyKey, fingerprint, operation);
  }

  async createOrGetActiveCart(cmd: CreateOrGetCartCommand): Promise<CartView> {
    if (cmd.userId) {
      const existing = await this.repo.findActiveByUserId(cmd.userId);
      if (existing && !existing.isExpired()) {
        return existing.toView(this.pricing);
      }
    } else if (cmd.sessionId) {
      const existing = await this.repo.findActiveBySessionId(cmd.sessionId);
      if (existing && !existing.isExpired()) {
        return existing.toView(this.pricing);
      }
    }

    const cart = Cart.create({
      userId: cmd.userId,
      sessionId: cmd.sessionId,
      currency: cmd.currency ?? 'EUR',
    });

    await this.repo.save(cart, 0);
    await this.eventBus.publish(cart.pullDomainEvents());
    return cart.toView(this.pricing);
  }

  async getCart(cartId: string): Promise<CartView> {
    const cart = await this.loadCartOrThrow(cartId);
    return cart.toView(this.pricing);
  }

  async addItem(cmd: AddCartItemCommand): Promise<CartView> {
    const product = await this.loadActiveProductOrThrow(cmd.sku);

    return this.mutateWithOptimisticRetry(
      cmd.cartId,
      cmd.expectedVersion,
      async (cart) => {
        const currentQty = cart.getItem(product.sku)?.quantity ?? 0;
        const targetQty = currentQty + cmd.quantity;

        if (cmd.quantity <= 0 || !Number.isInteger(cmd.quantity)) {
          throw new DomainError(
            'VALIDATION_ERROR',
            'La cantidad a añadir debe ser un entero positivo.',
            400,
          );
        }

        if (targetQty > product.availableStock) {
          throw new InsufficientStockError(
            product.sku,
            targetQty,
            product.availableStock,
          );
        }

        cart.upsertItem({
          sku: product.sku,
          name: product.name,
          unitPrice: Money.ofMinor(product.unitPriceMinor, product.currency),
          quantityDelta: cmd.quantity,
          imageUrl: product.imageUrl,
        });
      },
    );
  }

  async setItemQuantity(cmd: SetCartItemQuantityCommand): Promise<CartView> {
    if (cmd.quantity === 0) {
      return this.removeItem({
        cartId: cmd.cartId,
        sku: cmd.sku,
        expectedVersion: cmd.expectedVersion,
      });
    }

    const product = await this.loadActiveProductOrThrow(cmd.sku);
    if (cmd.quantity > product.availableStock) {
      throw new InsufficientStockError(
        product.sku,
        cmd.quantity,
        product.availableStock,
      );
    }

    return this.mutateWithOptimisticRetry(
      cmd.cartId,
      cmd.expectedVersion,
      async (cart) => {
        cart.upsertItem({
          sku: product.sku,
          name: product.name,
          unitPrice: Money.ofMinor(product.unitPriceMinor, product.currency),
          absoluteQuantity: cmd.quantity,
          imageUrl: product.imageUrl,
        });
      },
    );
  }

  async removeItem(cmd: RemoveCartItemCommand): Promise<CartView> {
    return this.mutateWithOptimisticRetry(
      cmd.cartId,
      cmd.expectedVersion,
      async (cart) => {
        cart.removeItem(cmd.sku);
      },
    );
  }

  async clearCart(cartId: string, expectedVersion?: number): Promise<CartView> {
    return this.mutateWithOptimisticRetry(cartId, expectedVersion, async (cart) => {
      cart.clear();
    });
  }

  async applyCoupon(cmd: ApplyCouponCommand): Promise<CartView> {
    return this.mutateWithOptimisticRetry(
      cmd.cartId,
      cmd.expectedVersion,
      async (cart) => {
        cart.applyCoupon(cmd.couponCode, this.pricing);
      },
    );
  }

  async removeCoupon(cartId: string, expectedVersion?: number): Promise<CartView> {
    return this.mutateWithOptimisticRetry(cartId, expectedVersion, async (cart) => {
      cart.removeCoupon();
    });
  }

  /**
   * Fusiona un carrito anónimo (invitado) al iniciar sesión un usuario autenticado.
   * Si el usuario aún no tenía carrito activo, o bien promociona/reutiliza o fusiona atómicamente.
   */
  async mergeGuestCart(cmd: MergeCartsCommand): Promise<CartView> {
    const userId = cmd.userId.trim();
    if (!userId) {
      throw new DomainError('VALIDATION_ERROR', 'El userId es obligatorio para fusionar.', 400);
    }

    for (let attempt = 0; attempt <= this.maxAutoRetries; attempt++) {
      const guestCart = await this.loadCartOrThrow(cmd.guestCartId);
      const guestVersion = guestCart.version;

      let userCart = await this.repo.findActiveByUserId(userId);
      if (userCart && userCart.id === guestCart.id) {
        return userCart.toView(this.pricing);
      }

      // Si el usuario no tiene carrito propio y el carrito invitado es anónimo, podemos asignarlo directamente
      if (!userCart && !guestCart.userId) {
        guestCart.assignToUser(userId);
        try {
          await this.repo.save(guestCart, guestVersion);
          await this.eventBus.publish(guestCart.pullDomainEvents());
          return guestCart.toView(this.pricing);
        } catch (err) {
          if (err instanceof ConcurrencyConflictError && attempt < this.maxAutoRetries) {
            continue;
          }
          throw err;
        }
      }

      let userExpectedVersion = 0;
      if (!userCart) {
        userCart = Cart.create({
          userId,
          currency: cmd.currency ?? guestCart.currency,
        });
      } else {
        userExpectedVersion = userCart.version;
      }

      const skus = guestCart.items.map((i) => i.sku);
      const productsMap = await this.catalog.getProducts(skus);
      const stockMap = new Map<string, number>();
      for (const [sku, prod] of productsMap.entries()) {
        stockMap.set(sku, prod.active ? prod.availableStock : 0);
      }

      userCart.mergeFrom(guestCart, stockMap);

      try {
        await this.repo.savePairAtomic(
          userCart,
          userExpectedVersion,
          guestCart,
          guestVersion,
        );
        const events = [
          ...userCart.pullDomainEvents(),
          ...guestCart.pullDomainEvents(),
        ];
        await this.eventBus.publish(events);
        return userCart.toView(this.pricing);
      } catch (err) {
        if (err instanceof ConcurrencyConflictError && attempt < this.maxAutoRetries) {
          continue;
        }
        throw err;
      }
    }

    throw new ConcurrencyConflictError(cmd.guestCartId, -1);
  }

  /**
   * Ejecuta el checkout del carrito mediante una Saga coordinada:
   * 1. Revalida precios vigentes y disponibilidad en catálogo.
   * 2. Reserva inventario de forma atómica.
   * 3. Marca el carrito como CHECKED_OUT con Control de Concurrencia Optimista.
   * 4. Confirma la reserva (o la libera en compensación si falla la persistencia).
   * 5. Publica eventos de dominio para sistemas aguas abajo (órdenes, facturación, envíos).
   */
  async checkout(cmd: CheckoutCartCommand): Promise<CheckoutResult> {
    const cart = await this.loadCartOrThrow(cmd.cartId);
    const initialVersion = cmd.expectedVersion ?? cart.version;

    if (cmd.expectedVersion !== undefined && cart.version !== cmd.expectedVersion) {
      throw new ConcurrencyConflictError(cart.id, cmd.expectedVersion, cart.version);
    }

    if (cart.items.length === 0) {
      throw new DomainError(
        'EMPTY_CART_CHECKOUT',
        'No se puede realizar checkout de un carrito vacío.',
        400,
      );
    }

    const skus = cart.items.map((i) => i.sku);
    const catalogMap = await this.catalog.getProducts(skus);
    const priceAdjustments: PriceAdjustmentNotice[] = [];

    for (const item of cart.items) {
      const product = catalogMap.get(item.sku);
      if (!product || !product.active) {
        throw new NotFoundError(
          'PRODUCT_NOT_FOUND',
          `El producto '${item.sku}' ya no está disponible para la venta.`,
        );
      }
      if (item.quantity > product.availableStock) {
        throw new InsufficientStockError(
          item.sku,
          item.quantity,
          product.availableStock,
        );
      }
      if (product.unitPriceMinor !== item.unitPriceMinor) {
        const previousPrice = Money.ofMinor(item.unitPriceMinor, cart.currency);
        const currentPrice = Money.ofMinor(product.unitPriceMinor, product.currency);
        priceAdjustments.push({
          sku: item.sku,
          previousUnitPrice: previousPrice.toJSON(),
          currentUnitPrice: currentPrice.toJSON(),
        });
        cart.upsertItem({
          sku: product.sku,
          name: product.name,
          unitPrice: currentPrice,
          absoluteQuantity: item.quantity,
          imageUrl: product.imageUrl,
        });
      }
    }

    const orderId = `ord_${randomUUID()}`;
    const reservationId = `res_${randomUUID()}`;
    const lines = cart.items.map((i) => ({ sku: i.sku, quantity: i.quantity }));

    await this.catalog.reserveStock(reservationId, lines);

    try {
      cart.markCheckedOut(orderId);
      await this.repo.save(cart, initialVersion);
      await this.catalog.commitReservation(reservationId);
    } catch (error) {
      // Acción compensatoria: liberamos el stock reservado si la transacción del carrito abortó
      await this.catalog.releaseReservation(reservationId);
      throw error;
    }

    await this.eventBus.publish(cart.pullDomainEvents());

    const cartView = cart.toView(this.pricing);
    const order: OrderSnapshot = {
      orderId,
      cartId: cart.id,
      userId: cart.userId,
      sessionId: cart.sessionId,
      customerEmail: cmd.customerEmail?.trim() || null,
      shippingAddress: cmd.shippingAddress?.trim() || null,
      reservationId,
      items: cartView.items,
      pricing: cartView.pricing,
      priceAdjustments,
      createdAt: cart.updatedAt,
    };

    return {
      order,
      cart: cartView,
    };
  }

  private async mutateWithOptimisticRetry(
    cartId: string,
    explicitExpectedVersion: number | undefined,
    mutator: (cart: Cart) => Promise<void>,
  ): Promise<CartView> {
    return this.withCartLock(cartId, async () => {
      const maxAttempts = explicitExpectedVersion !== undefined ? 1 : this.maxAutoRetries + 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const cart = await this.loadCartOrThrow(cartId);
        const expectedVersion = explicitExpectedVersion ?? cart.version;

        if (cart.version !== expectedVersion) {
          throw new ConcurrencyConflictError(cart.id, expectedVersion, cart.version);
        }

        const beforeVersion = cart.version;
        await mutator(cart);

        // Si la operación fue no-op (ej. vaciar un carrito ya vacío), evitamos escrituras innecesarias
        if (cart.version === beforeVersion) {
          return cart.toView(this.pricing);
        }

        try {
          await this.repo.save(cart, expectedVersion);
          await this.eventBus.publish(cart.pullDomainEvents());
          return cart.toView(this.pricing);
        } catch (err) {
          if (err instanceof ConcurrencyConflictError && attempt < maxAttempts) {
            const backoffMs = Math.min(25, attempt * 2) * Math.random();
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          throw err;
        }
      }

      throw new ConcurrencyConflictError(cartId, explicitExpectedVersion ?? -1);
    });
  }

  /**
   * Cola ligera asíncrona por cartId para evitar contención innecesaria intra-proceso
   * (ej. ráfagas de clics simultáneos en una misma instancia), liberando memoria al terminar.
   */
  private async withCartLock<T>(cartId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.cartLocks.get(cartId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.cartLocks.set(cartId, tail);

    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.cartLocks.get(cartId) === tail) {
        this.cartLocks.delete(cartId);
      }
    }
  }

  private async loadCartOrThrow(cartId: string): Promise<Cart> {
    const cart = await this.repo.findById(cartId);
    if (!cart) {
      throw new NotFoundError('CART_NOT_FOUND', `Carrito '${cartId}' no encontrado.`);
    }
    return cart;
  }

  private async loadActiveProductOrThrow(sku: string) {
    const product = await this.catalog.getProduct(sku.trim());
    if (!product || !product.active) {
      throw new NotFoundError(
        'PRODUCT_NOT_FOUND',
        `El producto '${sku}' no existe o no está activo en el catálogo.`,
      );
    }
    return product;
  }
}
