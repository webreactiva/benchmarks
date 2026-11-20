"""Entidades del dominio: Product, CartItem y Cart.

El carrito es seguro entre hilos (RLock interno) y registra eventos de
dominio que el servicio publica tras persistir.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable
from uuid import uuid4

from .events import (
    CartCleared,
    DomainEvent,
    ItemAdded,
    ItemQuantityUpdated,
    ItemRemoved,
)
from .exceptions import (
    CartError,
    CartLimitExceeded,
    InsufficientStock,
    InvalidQuantity,
    ItemNotInCart,
    ProductNotFound,
)
from .value_objects import Money, Quantity, SKU


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_sku(value: SKU | str) -> SKU:
    return value if isinstance(value, SKU) else SKU(str(value))


@dataclass(frozen=True)
class Product:
    """Producto del catálogo. ``stock=None`` significa stock ilimitado."""

    sku: SKU
    name: str
    price: Money
    stock: int | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.sku, SKU):
            object.__setattr__(self, "sku", SKU(str(self.sku)))
        if self.stock is not None and self.stock < 0:
            raise ValueError("El stock no puede ser negativo")


class CartItem:
    """Línea del carrito: un producto y su cantidad."""

    __slots__ = ("_product", "_quantity")

    def __init__(self, product: Product, quantity: Quantity | int = 1) -> None:
        self._product = product
        self._quantity = quantity if isinstance(quantity, Quantity) else Quantity(quantity)

    @property
    def product(self) -> Product:
        return self._product

    @property
    def quantity(self) -> Quantity:
        return self._quantity

    @property
    def sku(self) -> SKU:
        return self._product.sku

    def set_quantity(self, quantity: Quantity) -> None:
        self._quantity = quantity

    @property
    def line_total(self) -> Money:
        return self._product.price * self._quantity.value

    def __repr__(self) -> str:
        return f"CartItem({self.sku.value!r} x{self._quantity.value})"


class Cart:
    """Carrito de la compra, seguro entre hilos.

    - ``max_items``: límite de SKUs distintos (configurable por carrito).
    - ``MAX_QUANTITY_PER_ITEM``: límite de unidades por SKU.
    - Registra eventos de dominio que se drenan con ``drain_events()``.
    """

    MAX_QUANTITY_PER_ITEM = 999

    def __init__(self, cart_id: str | None = None, max_items: int = 100, currency: str = "EUR") -> None:
        if max_items < 1:
            raise ValueError("max_items debe ser >= 1")
        self.id = cart_id or uuid4().hex
        self.max_items = max_items
        self.currency = currency
        self.created_at = _now()
        self.updated_at = _now()
        self._items: dict[SKU, CartItem] = {}
        self._events: list[DomainEvent] = []
        self._lock = threading.RLock()

    # ------------------------------------------------------------- eventos
    def record_event(self, event: DomainEvent) -> None:
        with self._lock:
            self._events.append(event)

    def drain_events(self) -> list[DomainEvent]:
        with self._lock:
            events = list(self._events)
            self._events.clear()
            return events

    # ---------------------------------------------------------- mutaciones
    def add_item(self, product: Product, quantity: Quantity | int = 1) -> None:
        qty = quantity if isinstance(quantity, Quantity) else Quantity(quantity)
        with self._lock:
            self._check_currency(product.price)
            existing = self._items.get(product.sku)
            new_total = (existing.quantity.value if existing else 0) + qty.value
            self._check_item_limit(new_total)
            self._check_stock(product, new_total)
            if existing:
                existing.set_quantity(Quantity(new_total))
                self.record_event(ItemQuantityUpdated(self.id, product.sku.value, new_total))
            else:
                if len(self._items) >= self.max_items:
                    raise CartLimitExceeded(
                        f"El carrito admite como máximo {self.max_items} productos distintos"
                    )
                self._items[product.sku] = CartItem(product, qty)
                self.record_event(ItemAdded(self.id, product.sku.value, qty.value, new_total))
            self._touch()

    def update_quantity(self, sku: SKU | str, quantity: Quantity | int) -> None:
        sku = _as_sku(sku)
        qty = quantity if isinstance(quantity, Quantity) else Quantity(quantity)
        with self._lock:
            item = self._items.get(sku)
            if item is None:
                raise ItemNotInCart(f"{sku} no está en el carrito")
            self._check_item_limit(qty.value)
            self._check_stock(item.product, qty.value)
            item.set_quantity(qty)
            self.record_event(ItemQuantityUpdated(self.id, sku.value, qty.value))
            self._touch()

    def remove_item(self, sku: SKU | str) -> None:
        sku = _as_sku(sku)
        with self._lock:
            if sku not in self._items:
                raise ItemNotInCart(f"{sku} no está en el carrito")
            del self._items[sku]
            self.record_event(ItemRemoved(self.id, sku.value))
            self._touch()

    def clear(self) -> None:
        with self._lock:
            if self._items:
                self._items.clear()
                self.record_event(CartCleared(self.id))
                self._touch()

    # ------------------------------------------------------------ consultas
    @property
    def items(self) -> list[CartItem]:
        with self._lock:
            return sorted(self._items.values(), key=lambda i: i.sku.value)

    @property
    def subtotal(self) -> Money:
        with self._lock:
            total: Money | None = None
            for item in self._items.values():
                total = item.line_total if total is None else total + item.line_total
            return total if total is not None else Money(0, self.currency)

    @property
    def item_count(self) -> int:
        with self._lock:
            return sum(i.quantity.value for i in self._items.values())

    @property
    def distinct_items(self) -> int:
        with self._lock:
            return len(self._items)

    @property
    def is_empty(self) -> bool:
        return self.distinct_items == 0

    def contains(self, sku: SKU | str) -> bool:
        with self._lock:
            return _as_sku(sku) in self._items

    # ------------------------------------------------------- serialización
    def to_dict(self) -> dict:
        with self._lock:
            return {
                "id": self.id,
                "max_items": self.max_items,
                "currency": self.currency,
                "created_at": self.created_at.isoformat(),
                "updated_at": self.updated_at.isoformat(),
                "items": [
                    {"sku": item.sku.value, "quantity": item.quantity.value}
                    for item in self.items
                ],
            }

    @classmethod
    def from_dict(cls, data: dict, resolve_product: Callable[[SKU], Product]) -> "Cart":
        """Reconstruye un carrito desde su dict; los productos se resuelven
        con ``resolve_product`` (p. ej. ``catalogo.get``)."""
        cart = cls(
            cart_id=data["id"],
            max_items=int(data.get("max_items", 100)),
            currency=data.get("currency", "EUR"),
        )
        cart.created_at = datetime.fromisoformat(data["created_at"])
        cart.updated_at = datetime.fromisoformat(data["updated_at"])
        for raw in data.get("items", []):
            sku = SKU(raw["sku"])
            product = resolve_product(sku)
            if product is None:
                raise ProductNotFound(f"Producto desconocido al restaurar el carrito: {sku}")
            cart._items[sku] = CartItem(product, Quantity(int(raw["quantity"])))
        return cart

    # ------------------------------------------------------------- privados
    def _check_currency(self, price: Money) -> None:
        if price.currency != self.currency:
            raise CartError(
                f"El carrito usa {self.currency} y el producto usa {price.currency}"
            )

    def _check_item_limit(self, qty: int) -> None:
        if qty > self.MAX_QUANTITY_PER_ITEM:
            raise InvalidQuantity(
                f"Máximo {self.MAX_QUANTITY_PER_ITEM} unidades por producto"
            )

    def _check_stock(self, product: Product, qty: int) -> None:
        if product.stock is not None and qty > product.stock:
            raise InsufficientStock(
                f"Stock insuficiente de {product.sku}: solicitadas {qty}, "
                f"disponibles {product.stock}"
            )

    def _touch(self) -> None:
        self.updated_at = _now()

    def __repr__(self) -> str:
        return f"Cart(id={self.id!r}, items={self.distinct_items}, count={self.item_count})"
