import { Cart } from '../domain/cart.js';
import { buildLineKey } from '../domain/cart-item.js';
import { CartNotFoundError, CatalogItemNotFoundError, ConcurrencyConflictError, DomainError, InsufficientStockError, PromotionError, } from '../domain/errors.js';
function generateId(prefix) {
    const rand = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
export class CartService {
    cartRepo;
    catalog;
    inventory;
    pricingEngine;
    promotionRegistry;
    eventBus;
    idempotencyStore;
    defaultCurrency;
    defaultTtlMs;
    defaultLimits;
    maxConcurrencyRetries;
    constructor(deps) {
        this.cartRepo = deps.cartRepository;
        this.catalog = deps.catalog;
        this.inventory = deps.inventory;
        this.pricingEngine = deps.pricingEngine;
        this.promotionRegistry = deps.promotionRegistry;
        this.eventBus = deps.eventBus;
        if (deps.idempotencyStore !== undefined) {
            this.idempotencyStore = deps.idempotencyStore;
        }
        this.defaultCurrency = deps.config?.defaultCurrency ?? 'EUR';
        this.defaultTtlMs = deps.config?.defaultTtlMs ?? 7 * 24 * 60 * 60 * 1000;
        if (deps.config?.defaultLimits !== undefined) {
            this.defaultLimits = deps.config.defaultLimits;
        }
        this.maxConcurrencyRetries = deps.config?.maxConcurrencyRetries ?? 5;
    }
    async createCart(params) {
        if (params?.idempotencyKey && this.idempotencyStore) {
            const existingCartId = await this.idempotencyStore.get(`create:${params.idempotencyKey}`);
            if (existingCartId) {
                const existing = await this.cartRepo.findById(existingCartId);
                if (existing)
                    return existing;
            }
        }
        const cart = Cart.create({
            id: params?.cartId ?? generateId('cart'),
            ownerId: params?.ownerId ?? null,
            currency: params?.currency ?? this.defaultCurrency,
            ttlMs: params?.ttlMs !== undefined ? params.ttlMs : this.defaultTtlMs,
            ...(this.defaultLimits !== undefined ? { limits: this.defaultLimits } : {}),
        });
        await this.cartRepo.save(cart, null);
        await this.eventBus.publish(cart.pullDomainEvents());
        if (params?.idempotencyKey && this.idempotencyStore) {
            await this.idempotencyStore.set(`create:${params.idempotencyKey}`, cart.id);
        }
        return cart;
    }
    async getCart(cartId) {
        const cart = await this.cartRepo.findById(cartId);
        if (!cart) {
            throw new CartNotFoundError(cartId);
        }
        return cart;
    }
    async getCartSummary(cartId, now = new Date()) {
        const cart = await this.getCart(cartId);
        return this.pricingEngine.calculate(cart, now);
    }
    async addItem(command) {
        if (command.idempotencyKey && this.idempotencyStore) {
            const cachedCartId = await this.idempotencyStore.get(`add:${command.cartId}:${command.idempotencyKey}`);
            if (cachedCartId) {
                return this.getCartSummary(cachedCartId);
            }
        }
        const product = await this.catalog.getProduct(command.productId, command.variantId);
        if (!product || !product.active) {
            throw new CatalogItemNotFoundError(command.productId);
        }
        const summary = await this.executeWithRetry(command.cartId, command.expectedVersion, async (cart) => {
            const existingItem = cart.getItem(command.productId, command.variantId);
            const targetQuantity = (existingItem?.quantity ?? 0) + command.quantity;
            const available = await this.inventory.getAvailableStock(product.sku);
            if (available < targetQuantity) {
                throw new InsufficientStockError(product.productId, targetQuantity, available);
            }
            cart.addItem({
                productId: product.productId,
                ...(product.variantId !== undefined ? { variantId: product.variantId } : {}),
                sku: product.sku,
                name: product.name,
                categoryId: product.categoryId,
                taxCategory: product.taxCategory,
                unitPrice: product.unitPrice,
                quantity: command.quantity,
                ...(product.weightGrams !== undefined ? { weightGrams: product.weightGrams } : {}),
                ...(command.metadata !== undefined ? { metadata: command.metadata } : {}),
            }, this.defaultTtlMs !== null ? { extendTtlMs: this.defaultTtlMs } : undefined);
        });
        if (command.idempotencyKey && this.idempotencyStore) {
            await this.idempotencyStore.set(`add:${command.cartId}:${command.idempotencyKey}`, command.cartId);
        }
        return summary;
    }
    async updateItemQuantity(command) {
        return this.executeWithRetry(command.cartId, command.expectedVersion, async (cart) => {
            const existing = cart.getItemByLineKey(command.lineKey);
            if (!existing) {
                throw new DomainError('CART_ITEM_NOT_FOUND', `La línea "${command.lineKey}" no existe en el carrito "${cart.id}".`);
            }
            if (command.quantity > 0) {
                const available = await this.inventory.getAvailableStock(existing.sku);
                if (available < command.quantity) {
                    throw new InsufficientStockError(existing.productId, command.quantity, available);
                }
            }
            cart.updateItemQuantity(command.lineKey, command.quantity, this.defaultTtlMs !== null ? { extendTtlMs: this.defaultTtlMs } : undefined);
        });
    }
    async removeItem(cartId, lineKey, expectedVersion) {
        return this.executeWithRetry(cartId, expectedVersion, async (cart) => {
            cart.removeItem(lineKey, this.defaultTtlMs !== null ? { extendTtlMs: this.defaultTtlMs } : undefined);
        });
    }
    async clearCart(cartId, expectedVersion) {
        return this.executeWithRetry(cartId, expectedVersion, async (cart) => {
            cart.clear();
        });
    }
    async applyCoupon(cartId, code, expectedVersion) {
        const normalized = code.trim().toUpperCase();
        const rule = this.promotionRegistry.findByCouponCode(normalized);
        const now = new Date();
        if (!rule) {
            throw new PromotionError('COUPON_NOT_FOUND', `El cupón "${normalized}" no es válido.`);
        }
        if (!rule.isWithinSchedule(now)) {
            throw new PromotionError('COUPON_EXPIRED', `El cupón "${normalized}" está fuera de su periodo de vigencia.`);
        }
        return this.executeWithRetry(cartId, expectedVersion, async (cart) => {
            cart.applyCoupon(normalized, { now });
        });
    }
    async removeCoupon(cartId, code, expectedVersion) {
        return this.executeWithRetry(cartId, expectedVersion, async (cart) => {
            cart.removeCoupon(code);
        });
    }
    /**
     * Fusiona un carrito de invitado con el carrito activo del usuario autenticado.
     * Si el usuario no tenía carrito previo, le asigna el carrito de invitado.
     */
    async mergeGuestCart(params) {
        const guestCart = await this.getCart(params.guestCartId);
        const userCart = await this.cartRepo.findActiveByOwner(params.userId);
        if (!userCart || userCart.id === guestCart.id) {
            const previousVersion = guestCart.version;
            guestCart.assignOwner(params.userId);
            await this.cartRepo.save(guestCart, previousVersion);
            await this.eventBus.publish(guestCart.pullDomainEvents());
            return this.pricingEngine.calculate(guestCart);
        }
        const userPrevVersion = userCart.version;
        const guestPrevVersion = guestCart.version;
        // Verificamos stock disponible antes de fusionar
        for (const incoming of guestCart.items) {
            const existing = userCart.getItemByLineKey(incoming.lineKey);
            const combined = (existing?.quantity ?? 0) + incoming.quantity;
            const available = await this.inventory.getAvailableStock(incoming.sku);
            if (available < combined) {
                throw new InsufficientStockError(incoming.productId, combined, available);
            }
        }
        userCart.mergeFrom(guestCart);
        await this.cartRepo.save(userCart, userPrevVersion);
        await this.cartRepo.save(guestCart, guestPrevVersion);
        await this.eventBus.publish([
            ...userCart.pullDomainEvents(),
            ...guestCart.pullDomainEvents(),
        ]);
        return this.pricingEngine.calculate(userCart);
    }
    /**
     * Finaliza la compra con reserva atómica de inventario, compensación tipo Saga
     * ante conflicto de concurrencia e idempotencia para reintentos de red.
     */
    async checkout(command) {
        if (command.idempotencyKey && this.idempotencyStore) {
            const cached = await this.idempotencyStore.get(`checkout:${command.cartId}:${command.idempotencyKey}`);
            if (cached) {
                return cached;
            }
        }
        const cart = await this.getCart(command.cartId);
        if (command.expectedVersion !== undefined &&
            cart.version !== command.expectedVersion) {
            throw new ConcurrencyConflictError(cart.id, command.expectedVersion, cart.version);
        }
        if (cart.isEmpty()) {
            throw new DomainError('EMPTY_CART_CHECKOUT', `No se puede finalizar la compra de un carrito vacío ("${cart.id}").`);
        }
        const now = new Date();
        const summary = this.pricingEngine.calculate(cart, now);
        const reservations = cart.items.map((item) => ({
            sku: item.sku,
            productId: item.productId,
            quantity: item.quantity,
        }));
        // 1. Reservar inventario de forma atómica
        await this.inventory.reserveStock(reservations);
        const previousVersion = cart.version;
        try {
            // 2. Transicionar estado del carrito y guardar con bloqueo optimista
            cart.markCheckedOut(now);
            await this.cartRepo.save(cart, previousVersion);
        }
        catch (error) {
            // Compensación Saga: liberar stock si falla la persistencia del carrito
            await this.inventory.releaseStock(reservations);
            throw error;
        }
        await this.eventBus.publish(cart.pullDomainEvents());
        const result = {
            orderId: generateId('ord'),
            cartId: cart.id,
            ownerId: cart.ownerId,
            currency: cart.currency,
            checkedOutAt: now.toISOString(),
            grossSubtotalMinor: summary.grossSubtotal.amountMinor,
            totalDiscountMinor: summary.totalDiscount.amountMinor,
            netSubtotalMinor: summary.netSubtotal.amountMinor,
            totalTaxMinor: summary.tax.totalTax.amountMinor,
            shippingMinor: summary.shipping.cost.amountMinor,
            grandTotalMinor: summary.grandTotal.amountMinor,
            appliedPromotions: summary.appliedPromotions.map((p) => ({
                promotionId: p.promotionId,
                name: p.name,
                discountMinor: p.discount.amountMinor,
            })),
            items: summary.lines.map((line) => ({
                lineKey: line.lineKey,
                productId: line.productId,
                ...(line.variantId !== undefined ? { variantId: line.variantId } : {}),
                sku: line.sku,
                name: line.name,
                quantity: line.quantity,
                unitPriceMinor: line.unitPrice.amountMinor,
                netSubtotalMinor: line.netSubtotal.amountMinor,
            })),
        };
        if (command.idempotencyKey && this.idempotencyStore) {
            await this.idempotencyStore.set(`checkout:${command.cartId}:${command.idempotencyKey}`, result);
        }
        return result;
    }
    buildLineKey(productId, variantId) {
        return buildLineKey(productId, variantId);
    }
    async executeWithRetry(cartId, explicitExpectedVersion, mutator) {
        const attempts = explicitExpectedVersion !== undefined ? 1 : this.maxConcurrencyRetries;
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            const cart = await this.getCart(cartId);
            const currentVersion = cart.version;
            if (explicitExpectedVersion !== undefined &&
                currentVersion !== explicitExpectedVersion) {
                throw new ConcurrencyConflictError(cartId, explicitExpectedVersion, currentVersion);
            }
            await mutator(cart);
            try {
                await this.cartRepo.save(cart, currentVersion);
                await this.eventBus.publish(cart.pullDomainEvents());
                return this.pricingEngine.calculate(cart);
            }
            catch (error) {
                if (error instanceof ConcurrencyConflictError && attempt < attempts) {
                    continue;
                }
                throw error;
            }
        }
        throw new DomainError('CONCURRENCY_RETRY_EXHAUSTED', 'Se agotaron los reintentos de concurrencia.');
    }
}
//# sourceMappingURL=cart-service.js.map