import { buildLineKey, CartItem, } from './cart-item.js';
import { CartInactiveError, DomainError } from './errors.js';
import { createDomainEvent } from './events.js';
import { Money } from './money.js';
const DEFAULT_LIMITS = {
    maxLineItems: 500,
    maxQuantityPerLine: 999,
};
/**
 * Aggregate Root: Cart
 * Encapsula invariantes de negocio, control de concurrencia optimista (`version`)
 * y emisión de eventos de dominio.
 */
export class Cart {
    id;
    _ownerId;
    currency;
    _status;
    _version;
    _items;
    _couponCodes;
    createdAt;
    _updatedAt;
    _expiresAt;
    limits;
    _domainEvents = [];
    constructor(params) {
        this.id = params.id;
        this._ownerId = params.ownerId;
        this.currency = params.currency.trim().toUpperCase();
        this._status = params.status;
        this._version = params.version;
        this._items = params.items;
        this._couponCodes = params.couponCodes;
        this.createdAt = params.createdAt;
        this._updatedAt = params.updatedAt;
        this._expiresAt = params.expiresAt;
        this.limits = params.limits;
    }
    static create(options) {
        const now = options.now ?? new Date();
        const limits = {
            maxLineItems: options.limits?.maxLineItems ?? DEFAULT_LIMITS.maxLineItems,
            maxQuantityPerLine: options.limits?.maxQuantityPerLine ?? DEFAULT_LIMITS.maxQuantityPerLine,
        };
        const expiresAt = options.ttlMs !== undefined && options.ttlMs !== null
            ? new Date(now.getTime() + options.ttlMs)
            : null;
        const cart = new Cart({
            id: options.id,
            ownerId: options.ownerId ?? null,
            currency: Money.zero(options.currency).currency,
            status: 'ACTIVE',
            version: 1,
            items: new Map(),
            couponCodes: new Set(),
            createdAt: now,
            updatedAt: now,
            expiresAt,
            limits,
        });
        cart._domainEvents.push(createDomainEvent('CartCreated', cart.id, cart._version, { ownerId: cart._ownerId, currency: cart.currency }, now));
        return cart;
    }
    static fromSnapshot(snapshot) {
        const items = new Map();
        for (const itemSnap of snapshot.items) {
            const item = CartItem.fromSnapshot(itemSnap);
            items.set(item.lineKey, item);
        }
        return new Cart({
            id: snapshot.id,
            ownerId: snapshot.ownerId,
            currency: snapshot.currency,
            status: snapshot.status,
            version: snapshot.version,
            items,
            couponCodes: new Set(snapshot.couponCodes),
            createdAt: new Date(snapshot.createdAt),
            updatedAt: new Date(snapshot.updatedAt),
            expiresAt: snapshot.expiresAt ? new Date(snapshot.expiresAt) : null,
            limits: { ...snapshot.limits },
        });
    }
    get ownerId() {
        return this._ownerId;
    }
    get status() {
        return this._status;
    }
    get version() {
        return this._version;
    }
    get updatedAt() {
        return this._updatedAt;
    }
    get expiresAt() {
        return this._expiresAt;
    }
    get items() {
        return Array.from(this._items.values());
    }
    get couponCodes() {
        return Array.from(this._couponCodes);
    }
    get lineCount() {
        return this._items.size;
    }
    get totalQuantity() {
        let total = 0;
        for (const item of this._items.values()) {
            total += item.quantity;
        }
        return total;
    }
    isEmpty() {
        return this._items.size === 0;
    }
    isExpired(now = new Date()) {
        if (this._status === 'EXPIRED')
            return true;
        if (this._expiresAt !== null && now.getTime() >= this._expiresAt.getTime()) {
            return true;
        }
        return false;
    }
    getItem(productId, variantId) {
        return this._items.get(buildLineKey(productId, variantId));
    }
    getItemByLineKey(lineKey) {
        return this._items.get(lineKey);
    }
    subtotal() {
        let acc = Money.zero(this.currency);
        for (const item of this._items.values()) {
            acc = acc.add(item.subtotal());
        }
        return acc;
    }
    totalWeightGrams() {
        let total = 0;
        for (const item of this._items.values()) {
            total += item.totalWeightGrams();
        }
        return total;
    }
    assertActive(now = new Date()) {
        if (this._status !== 'ACTIVE') {
            throw new CartInactiveError(this.id, this._status);
        }
        if (this.isExpired(now)) {
            this._status = 'EXPIRED';
            throw new CartInactiveError(this.id, 'EXPIRED');
        }
    }
    touch(now, extendTtlMs) {
        this._version += 1;
        this._updatedAt = now;
        if (extendTtlMs !== undefined) {
            this._expiresAt = new Date(now.getTime() + extendTtlMs);
        }
    }
    addItem(props, options) {
        const now = options?.now ?? new Date();
        this.assertActive(now);
        if (props.unitPrice.currency !== this.currency) {
            Money.zero(this.currency).assertSameCurrency(props.unitPrice);
        }
        const lineKey = buildLineKey(props.productId, props.variantId);
        const existing = this._items.get(lineKey);
        if (existing) {
            const nextQuantity = existing.quantity + props.quantity;
            const updated = new CartItem({
                ...props,
                quantity: nextQuantity,
            }).withQuantity(nextQuantity, this.limits.maxQuantityPerLine);
            this._items.set(lineKey, updated);
            this.touch(now, options?.extendTtlMs);
            this._domainEvents.push(createDomainEvent('CartItemQuantityUpdated', this.id, this._version, {
                lineKey,
                productId: props.productId,
                previousQuantity: existing.quantity,
                newQuantity: nextQuantity,
            }, now));
            return updated;
        }
        if (this._items.size >= this.limits.maxLineItems) {
            throw new DomainError('MAX_CART_LINES_EXCEEDED', `El carrito no puede superar ${this.limits.maxLineItems} líneas distintas.`, { maxLineItems: this.limits.maxLineItems });
        }
        const item = new CartItem(props).withQuantity(props.quantity, this.limits.maxQuantityPerLine);
        this._items.set(lineKey, item);
        this.touch(now, options?.extendTtlMs);
        this._domainEvents.push(createDomainEvent('CartItemAdded', this.id, this._version, {
            lineKey,
            productId: item.productId,
            quantity: item.quantity,
            unitPriceMinor: item.unitPrice.amountMinor,
        }, now));
        return item;
    }
    updateItemQuantity(lineKey, newQuantity, options) {
        const now = options?.now ?? new Date();
        this.assertActive(now);
        const existing = this._items.get(lineKey);
        if (!existing) {
            throw new DomainError('CART_ITEM_NOT_FOUND', `La línea "${lineKey}" no existe en el carrito "${this.id}".`, { cartId: this.id, lineKey });
        }
        if (newQuantity === 0) {
            this._items.delete(lineKey);
            this.touch(now, options?.extendTtlMs);
            this._domainEvents.push(createDomainEvent('CartItemRemoved', this.id, this._version, { lineKey, productId: existing.productId }, now));
            return null;
        }
        const updated = existing.withQuantity(newQuantity, this.limits.maxQuantityPerLine);
        this._items.set(lineKey, updated);
        this.touch(now, options?.extendTtlMs);
        this._domainEvents.push(createDomainEvent('CartItemQuantityUpdated', this.id, this._version, {
            lineKey,
            productId: existing.productId,
            previousQuantity: existing.quantity,
            newQuantity,
        }, now));
        return updated;
    }
    removeItem(lineKey, options) {
        const now = options?.now ?? new Date();
        this.assertActive(now);
        const existing = this._items.get(lineKey);
        if (!existing) {
            return false;
        }
        this._items.delete(lineKey);
        this.touch(now, options?.extendTtlMs);
        this._domainEvents.push(createDomainEvent('CartItemRemoved', this.id, this._version, { lineKey, productId: existing.productId }, now));
        return true;
    }
    clear(options) {
        const now = options?.now ?? new Date();
        this.assertActive(now);
        const removedCount = this._items.size;
        if (removedCount === 0 && this._couponCodes.size === 0) {
            return;
        }
        this._items.clear();
        this._couponCodes.clear();
        this.touch(now);
        this._domainEvents.push(createDomainEvent('CartCleared', this.id, this._version, { removedCount }, now));
    }
    applyCoupon(code, options) {
        const now = options?.now ?? new Date();
        this.assertActive(now);
        const normalized = code.trim().toUpperCase();
        if (!normalized) {
            throw new DomainError('INVALID_COUPON_CODE', 'El código de cupón no puede estar vacío.');
        }
        if (this._couponCodes.has(normalized)) {
            return false;
        }
        this._couponCodes.add(normalized);
        this.touch(now);
        this._domainEvents.push(createDomainEvent('CartCouponApplied', this.id, this._version, { code: normalized }, now));
        return true;
    }
    removeCoupon(code, options) {
        const now = options?.now ?? new Date();
        this.assertActive(now);
        const normalized = code.trim().toUpperCase();
        const deleted = this._couponCodes.delete(normalized);
        if (!deleted)
            return false;
        this.touch(now);
        this._domainEvents.push(createDomainEvent('CartCouponRemoved', this.id, this._version, { code: normalized }, now));
        return true;
    }
    assignOwner(ownerId, now = new Date()) {
        this.assertActive(now);
        this._ownerId = ownerId;
        this.touch(now);
    }
    /**
     * Fusiona los ítems y cupones de otro carrito (por ejemplo, de sesión invitada)
     * dentro de este carrito, marcando el carrito origen como MERGED.
     */
    mergeFrom(source, now = new Date()) {
        this.assertActive(now);
        source.assertActive(now);
        if (this.id === source.id) {
            throw new DomainError('SELF_MERGE', 'No se puede fusionar un carrito consigo mismo.');
        }
        if (this.currency !== source.currency) {
            Money.zero(this.currency).assertSameCurrency(Money.zero(source.currency));
        }
        let mergedCount = 0;
        for (const incoming of source.items) {
            const existing = this._items.get(incoming.lineKey);
            if (existing) {
                const combined = Math.min(existing.quantity + incoming.quantity, this.limits.maxQuantityPerLine);
                this._items.set(incoming.lineKey, incoming.withQuantity(combined, this.limits.maxQuantityPerLine));
                mergedCount += 1;
            }
            else {
                if (this._items.size >= this.limits.maxLineItems) {
                    break;
                }
                const boundedQty = Math.min(incoming.quantity, this.limits.maxQuantityPerLine);
                this._items.set(incoming.lineKey, incoming.withQuantity(boundedQty, this.limits.maxQuantityPerLine));
                mergedCount += 1;
            }
        }
        for (const code of source.couponCodes) {
            this._couponCodes.add(code);
        }
        source._status = 'MERGED';
        source.touch(now);
        this.touch(now);
        this._domainEvents.push(createDomainEvent('CartMerged', this.id, this._version, { sourceCartId: source.id, mergedItemsCount: mergedCount }, now));
        return mergedCount;
    }
    markCheckedOut(now = new Date()) {
        this.assertActive(now);
        if (this._items.size === 0) {
            throw new DomainError('EMPTY_CART_CHECKOUT', `No se puede finalizar la compra de un carrito vacío ("${this.id}").`);
        }
        this._status = 'CHECKED_OUT';
        this.touch(now);
        this._domainEvents.push(createDomainEvent('CartCheckedOut', this.id, this._version, { ownerId: this._ownerId, itemCount: this.totalQuantity }, now));
    }
    markExpired(now = new Date()) {
        if (this._status === 'ACTIVE') {
            this._status = 'EXPIRED';
            this.touch(now);
        }
    }
    pullDomainEvents() {
        const events = [...this._domainEvents];
        this._domainEvents = [];
        return events;
    }
    toSnapshot() {
        return {
            id: this.id,
            ownerId: this._ownerId,
            currency: this.currency,
            status: this._status,
            version: this._version,
            items: Array.from(this._items.values(), (item) => item.toSnapshot()),
            couponCodes: Array.from(this._couponCodes),
            createdAt: this.createdAt.toISOString(),
            updatedAt: this._updatedAt.toISOString(),
            expiresAt: this._expiresAt ? this._expiresAt.toISOString() : null,
            limits: { ...this.limits },
        };
    }
}
//# sourceMappingURL=cart.js.map