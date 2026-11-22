"""Excepciones de dominio del carrito."""


class CartError(Exception):
    """Base de todos los errores del dominio del carrito."""


class CartNotFound(CartError):
    """El carrito solicitado no existe en el repositorio."""


class ProductNotFound(CartError):
    """El SKU no existe en el catálogo."""


class ItemNotInCart(CartError):
    """Se intentó operar con un producto que no está en el carrito."""


class CartLimitExceeded(CartError):
    """Se alcanzó el número máximo de productos distintos por carrito."""


class InsufficientStock(CartError):
    """La cantidad solicitada supera el stock disponible."""


class InvalidQuantity(CartError):
    """La cantidad supera el máximo permitido por producto."""


class EmptyCart(CartError):
    """Operación no permitida sobre un carrito vacío (p. ej. checkout)."""
