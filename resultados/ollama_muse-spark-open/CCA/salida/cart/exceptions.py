"""Excepciones de dominio para el carrito."""

class CartError(Exception):
    """Base para todos los errores del carrito."""
    pass

class CartNotFoundError(CartError):
    pass

class ProductNotFoundError(CartError):
    pass

class InsufficientStockError(CartError):
    def __init__(self, product_id: str, requested: int, available: int):
        super().__init__(
            f"Stock insuficiente para {product_id}: solicitado {requested}, disponible {available}"
        )
        self.product_id = product_id
        self.requested = requested
        self.available = available

class CartExpiredError(CartError):
    pass

class InvalidQuantityError(CartError):
    pass

class CartLimitExceededError(CartError):
    pass

class CouponError(CartError):
    pass

class ConcurrencyError(CartError):
    """Error de control de concurrencia optimista."""
    pass
