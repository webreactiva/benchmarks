"""Carrito de la compra escalable (arquitectura hexagonal, sin dependencias).

Capas:
- ``cart.domain``: entidades, value objects, eventos y excepciones (puro).
- ``cart.application``: casos de uso (``CartService``), puertos y motor de
  precios con estrategias enchufables.
- ``cart.infrastructure``: adaptadores (memoria / SQLite).
"""
from .application.pricing import (
    DiscountStrategy,
    FixedDiscount,
    PercentageDiscount,
    PercentageTax,
    PricingEngine,
    Receipt,
    ReceiptLine,
    TaxStrategy,
)
from .application.services import CartService
from .domain.entities import Cart, CartItem, Product
from .domain.events import (
    CartCheckedOut,
    CartCleared,
    CartCreated,
    CartMerged,
    DomainEvent,
    EventBus,
    ItemAdded,
    ItemQuantityUpdated,
    ItemRemoved,
)
from .domain.exceptions import (
    CartError,
    CartLimitExceeded,
    CartNotFound,
    EmptyCart,
    InsufficientStock,
    InvalidQuantity,
    ItemNotInCart,
    ProductNotFound,
)
from .domain.value_objects import Money, Quantity, SKU
from .infrastructure.repositories import (
    InMemoryCartRepository,
    InMemoryProductCatalog,
    SqliteCartRepository,
)

__version__ = "1.0.0"

__all__ = [
    "Cart",
    "CartItem",
    "CartError",
    "CartLimitExceeded",
    "CartNotFound",
    "CartService",
    "CartCheckedOut",
    "CartCleared",
    "CartCreated",
    "CartMerged",
    "DiscountStrategy",
    "DomainEvent",
    "EmptyCart",
    "EventBus",
    "FixedDiscount",
    "InMemoryCartRepository",
    "InMemoryProductCatalog",
    "InsufficientStock",
    "InvalidQuantity",
    "ItemAdded",
    "ItemNotInCart",
    "ItemQuantityUpdated",
    "ItemRemoved",
    "Money",
    "PercentageDiscount",
    "PercentageTax",
    "PricingEngine",
    "Product",
    "ProductNotFound",
    "Quantity",
    "Receipt",
    "ReceiptLine",
    "SKU",
    "SqliteCartRepository",
    "TaxStrategy",
]
