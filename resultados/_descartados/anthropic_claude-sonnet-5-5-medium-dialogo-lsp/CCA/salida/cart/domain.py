"""Dominio del carrito: inmutable, sin I/O, dinero en céntimos (enteros)."""
from __future__ import annotations

from dataclasses import dataclass, field, replace
from types import MappingProxyType
from typing import Mapping

MAX_DISTINCT_ITEMS = 100
MAX_QTY_PER_ITEM = 999


class CartError(Exception):
    pass


class InvalidQuantity(CartError):
    pass


class CartLimitExceeded(CartError):
    pass


class ItemNotFound(CartError):
    pass


class ConcurrencyError(CartError):
    """La versión guardada no coincide con la esperada (escritura concurrente)."""


class UnknownProduct(CartError):
    pass


@dataclass(frozen=True)
class CartItem:
    sku: str
    name: str
    unit_price: int  # céntimos
    quantity: int

    @property
    def subtotal(self) -> int:
        return self.unit_price * self.quantity


@dataclass(frozen=True)
class Cart:
    cart_id: str
    currency: str = "EUR"
    items: Mapping[str, CartItem] = field(default_factory=lambda: MappingProxyType({}))
    version: int = 0  # 0 = aún no persistido

    # --- consultas ---
    @property
    def total(self) -> int:
        return sum(i.subtotal for i in self.items.values())

    @property
    def item_count(self) -> int:
        return sum(i.quantity for i in self.items.values())

    # --- transformaciones (devuelven un carrito nuevo) ---
    def _with_items(self, items: dict[str, CartItem]) -> "Cart":
        return replace(self, items=MappingProxyType(items))

    def add(self, sku: str, name: str, unit_price: int, quantity: int = 1) -> "Cart":
        if quantity < 1:
            raise InvalidQuantity("La cantidad debe ser >= 1")
        if unit_price < 0:
            raise ValueError("Precio negativo")
        items = dict(self.items)
        current = items.get(sku)
        new_qty = quantity + (current.quantity if current else 0)
        if new_qty > MAX_QTY_PER_ITEM:
            raise CartLimitExceeded(f"Máximo {MAX_QTY_PER_ITEM} unidades por producto")
        if current is None and len(items) >= MAX_DISTINCT_ITEMS:
            raise CartLimitExceeded(f"Máximo {MAX_DISTINCT_ITEMS} productos distintos")
        items[sku] = CartItem(sku, name, unit_price, new_qty)
        return self._with_items(items)

    def set_quantity(self, sku: str, quantity: int) -> "Cart":
        if sku not in self.items:
            raise ItemNotFound(sku)
        if quantity < 0:
            raise InvalidQuantity("La cantidad no puede ser negativa")
        if quantity == 0:
            return self.remove(sku)
        if quantity > MAX_QTY_PER_ITEM:
            raise CartLimitExceeded(f"Máximo {MAX_QTY_PER_ITEM} unidades por producto")
        items = dict(self.items)
        items[sku] = replace(items[sku], quantity=quantity)
        return self._with_items(items)

    def remove(self, sku: str) -> "Cart":
        if sku not in self.items:
            raise ItemNotFound(sku)
        items = dict(self.items)
        del items[sku]
        return self._with_items(items)

    def clear(self) -> "Cart":
        return self._with_items({})

    def merge(self, other: "Cart") -> "Cart":
        """Fusiona otro carrito (p. ej. anónimo -> usuario), sumando cantidades."""
        result = self
        for i in other.items.values():
            result = result.add(i.sku, i.name, i.unit_price,
                                min(i.quantity, MAX_QTY_PER_ITEM - (result.items[i.sku].quantity if i.sku in result.items else 0)) or 0
                                ) if _room(result, i) else result
        return result


def _room(cart: Cart, item: CartItem) -> bool:
    cur = cart.items.get(item.sku)
    return (cur.quantity if cur else 0) < MAX_QTY_PER_ITEM and (
        cur is not None or len(cart.items) < MAX_DISTINCT_ITEMS
    )
