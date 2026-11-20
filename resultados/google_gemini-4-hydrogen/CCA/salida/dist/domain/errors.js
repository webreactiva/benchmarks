export class DomainError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        if (details !== undefined) {
            this.details = details;
        }
    }
}
export class CartNotFoundError extends DomainError {
    constructor(cartId) {
        super('CART_NOT_FOUND', `El carrito "${cartId}" no existe.`, { cartId });
    }
}
export class CartInactiveError extends DomainError {
    constructor(cartId, status) {
        super('CART_INACTIVE', `El carrito "${cartId}" no puede modificarse porque su estado es "${status}".`, { cartId, status });
    }
}
export class ConcurrencyConflictError extends DomainError {
    constructor(cartId, expectedVersion, actualVersion) {
        super('CONCURRENCY_CONFLICT', `Conflicto de concurrencia en carrito "${cartId}": se esperaba versión ${expectedVersion}, pero la actual es ${actualVersion}.`, { cartId, expectedVersion, actualVersion });
    }
}
export class InvalidCurrencyError extends DomainError {
    constructor(expected, actual) {
        super('INVALID_CURRENCY', `Moneda incompatible: se esperaba "${expected}", se recibió "${actual}".`, { expected, actual });
    }
}
export class InvalidQuantityError extends DomainError {
    constructor(quantity, reason = 'La cantidad debe ser un entero positivo.') {
        super('INVALID_QUANTITY', `${reason} Valor recibido: ${quantity}.`, { quantity });
    }
}
export class InsufficientStockError extends DomainError {
    constructor(productId, requested, available) {
        super('INSUFFICIENT_STOCK', `Stock insuficiente para el producto "${productId}": solicitado ${requested}, disponible ${available}.`, { productId, requested, available });
    }
}
export class CatalogItemNotFoundError extends DomainError {
    constructor(productId) {
        super('CATALOG_ITEM_NOT_FOUND', `Producto "${productId}" no encontrado en el catálogo.`, {
            productId,
        });
    }
}
export class PromotionError extends DomainError {
    constructor(code, message, details) {
        super(code, message, details);
    }
}
//# sourceMappingURL=errors.js.map