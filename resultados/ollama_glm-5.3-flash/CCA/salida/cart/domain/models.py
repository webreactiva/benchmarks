from __future__ import annotations

import time
import uuid
from decimal import Decimal
from typing import Any

from .exceptions import (
    CartCheckedOutError,
    DuplicateProductError,
    EmptyCartError,
    InvalidProductError,
    InvalidQuantityError,
    ItemLimitExceededError,
    ProductNotFoundInCartError,
    QuantityLimitExceededError,
)

MAX_DISTINCT_ITEMS = 50
MAX_QUANTITY_PER_LINE = 99


class CartStatus:
    ACTIVE = "active"
    CHECKED_OUT = "checked_out"


class Product:
    __slots__ = ("id", "name", "price")

    def __init__(self, product_id: str, name: str, price: Decimal) -> None:
        if not isinstance(product_id, str) or not product_id:
            raise InvalidProductError("product id must be a non-empty string")
        if not isinstance(name, str) or not name.strip():
            raise InvalidProductError("product name must be a non-empty string")
        if not isinstance(price, Decimal):
            raise InvalidProductError("product price must be a Decimal")
        if not price.is_finite() or price < 0:
            raise InvalidProductError("product price must be a finite non-negative number")
        self.id = product_id
        self.name = name
        self.price = price

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Product):
            return NotImplemented
        return (self.id, self.name, self.price) == (other.id, other.name, other.price)

    def __hash__(self) -> int:
        return hash((self.id, self.name, self.price))

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "price": str(self.price)}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Product":
        return cls(product_id=data["id"], name=data["name"], price=Decimal(str(data["price"])))


class CartItem:
    __slots__ = ("product_id", "name", "unit_price", "quantity")

    def __init__(self, product_id: str, name: str, unit_price: Decimal, quantity: int) -> None:
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
            raise InvalidQuantityError(f"quantity must be a positive integer, got {quantity!r}")
        self.quantity = quantity
        self.product_id = product_id
        self.name = name
        self.unit_price = unit_price

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, CartItem):
            return NotImplemented
        return (
            self.product_id,
            self.name,
            self.unit_price,
            self.quantity,
        ) == (other.product_id, other.name, other.unit_price, other.quantity)

    @property
    def line_total(self) -> Decimal:
        return self.unit_price * self.quantity

    def with_quantity(self, quantity: int) -> "CartItem":
        return CartItem(self.product_id, self.name, self.unit_price, quantity)

    def to_dict(self) -> dict[str, Any]:
        return {
            "product_id": self.product_id,
            "name": self.name,
            "unit_price": str(self.unit_price),
            "quantity": self.quantity,
            "line_total": str(self.line_total),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CartItem":
        return cls(
            product_id=data["product_id"],
            name=data["name"],
            unit_price=Decimal(str(data["unit_price"])),
            quantity=data["quantity"],
        )


class Cart:
    __slots__ = ("id", "items", "version", "status", "created_at", "updated_at")

    def __init__(
        self,
        cart_id: str | None = None,
        *,
        version: int = 0,
        status: str = CartStatus.ACTIVE,
        created_at: float | None = None,
        updated_at: float | None = None,
    ) -> None:
        self.id = cart_id or uuid.uuid4().hex
        self.items: dict[str, CartItem] = {}
        self.version = version
        self.status = status
        now = time.time()
        self.created_at = created_at if created_at is not None else now
        self.updated_at = updated_at if updated_at is not None else now

    def _ensure_active(self) -> None:
        if self.status != CartStatus.ACTIVE:
            raise CartCheckedOutError(f"cart {self.id} is already checked out")

    def add_item(self, product: Product, quantity: int) -> CartItem:
        self._ensure_active()
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
            raise InvalidQuantityError(f"quantity must be a positive integer, got {quantity!r}")
        if product.id in self.items:
            raise DuplicateProductError(
                f"product {product.id} is already in cart {self.id}; use PATCH to update quantity"
            )
        if len(self.items) >= MAX_DISTINCT_ITEMS:
            raise ItemLimitExceededError(f"cart {self.id} cannot hold more than {MAX_DISTINCT_ITEMS} distinct items")
        if quantity > MAX_QUANTITY_PER_LINE:
            raise QuantityLimitExceededError(f"quantity per line cannot exceed {MAX_QUANTITY_PER_LINE}")
        item = CartItem(product.id, product.name, product.price, quantity)
        self.items[product.id] = item
        self.version += 1
        self.updated_at = time.time()
        return item

    def update_quantity(self, product_id: str, quantity: int) -> CartItem:
        self._ensure_active()
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
            raise InvalidQuantityError(f"quantity must be a positive integer, got {quantity!r}")
        if product_id not in self.items:
            raise ProductNotFoundInCartError(f"product {product_id} is not in cart {self.id}")
        if quantity > MAX_QUANTITY_PER_LINE:
            raise QuantityLimitExceededError(f"quantity per line cannot exceed {MAX_QUANTITY_PER_LINE}")
        item = self.items[product_id].with_quantity(quantity)
        self.items[product_id] = item
        self.version += 1
        self.updated_at = time.time()
        return item

    def remove_item(self, product_id: str) -> None:
        self._ensure_active()
        if product_id not in self.items:
            raise ProductNotFoundInCartError(f"product {product_id} is not in cart {self.id}")
        del self.items[product_id]
        self.version += 1
        self.updated_at = time.time()

    def clear(self) -> None:
        self._ensure_active()
        self.items.clear()
        self.version += 1
        self.updated_at = time.time()

    def checkout(self) -> None:
        self._ensure_active()
        if not self.items:
            raise EmptyCartError(f"cart {self.id} is empty")
        self.status = CartStatus.CHECKED_OUT
        self.version += 1
        self.updated_at = time.time()

    def is_empty(self) -> bool:
        return not self.items

    def item_count(self) -> int:
        return len(self.items)

    def total_units(self) -> int:
        return sum(item.quantity for item in self.items.values())

    def total(self) -> Decimal:
        return sum((item.line_total for item in self.items.values()), Decimal("0"))

    def snapshot(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "status": self.status,
            "version": self.version,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "item_count": self.item_count(),
            "total_units": self.total_units(),
            "total": str(self.total()),
            "items": [item.to_dict() for item in self.items.values()],
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "version": self.version,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "items": {pid: item.to_dict() for pid, item in self.items.items()},
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Cart":
        cart = cls.__new__(cls)
        cart.id = data["id"]
        cart.version = int(data["version"])
        cart.status = data["status"]
        cart.created_at = float(data["created_at"])
        cart.updated_at = float(data["updated_at"])
        cart.items = {pid: CartItem.from_dict(item) for pid, item in data["items"].items()}
        return cart
