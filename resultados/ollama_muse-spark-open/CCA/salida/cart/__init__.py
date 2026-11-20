"""
Carrito de la Compra Escalable
-------------------------------
Paquete principal. Exporta la API pública.
"""
from .models import Product, CartItem, Cart, CartStatus, Money
from .exceptions import (
    CartError,
    CartNotFoundError,
    ProductNotFoundError,
    InsufficientStockError,
    CartExpiredError,
    InvalidQuantityError,
    CartLimitExceededError,
    CouponError,
)
from .storage import CartStorage, InMemoryCartStorage, ShardedCartStorage
from .pricing import (
    PricingEngine,
    PricingRule,
    BulkDiscountRule,
    CategoryDiscountRule,
    CouponDiscountRule,
    Coupon,
    CouponType,
    TaxCalculator,
    ShippingCalculator,
)
from .inventory import InventoryService, InMemoryInventory
from .events import EventBus, CartEvent, EventType
from .service import CartService
from .cart import CartAggregate

__all__ = [
    "Product", "CartItem", "Cart", "CartStatus", "Money",
    "CartError", "CartNotFoundError", "ProductNotFoundError",
    "InsufficientStockError", "CartExpiredError", "InvalidQuantityError",
    "CartLimitExceededError", "CouponError",
    "CartStorage", "InMemoryCartStorage", "ShardedCartStorage",
    "PricingEngine", "PricingRule", "BulkDiscountRule", "CategoryDiscountRule", "CouponDiscountRule",
    "Coupon", "CouponType", "TaxCalculator", "ShippingCalculator",
    "InventoryService", "InMemoryInventory",
    "EventBus", "CartEvent", "EventType",
    "CartService", "CartAggregate",
]

__version__ = "1.0.0"
