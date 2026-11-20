"""Dominio puro: sin I/O. Los objetos son inmutables; cada operación devuelve un carrito nuevo.

Esto permite control de concurrencia optimista (campo `version`) y que cualquier
instancia del servicio pueda atender cualquier petición (sin estado en memoria).
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Mapping

MAX_DISTINCT_ITEMS = 100
MAX_QTY_PER_ITEM = 999


class CartError(Exception):
    pass


class ConcurrencyError(CartError):
    """La versión guardada no coincide con la esperada."""


class ProductNotFound(CartError):
    pass


@dataclass(frozen=True)
class CartItem:
    sku: str
    quantity: int
    unit_price_cents: int  # dinero siempre en enteros (céntimos), nunca float

    @property
    def subtotal_cents(self) -> int:
        return self.quantity * self.unit_price_cents


@dataclass(frozen=True)
class Cart:
    id: str
    items: Mapping[str, CartItem] = field(default_factory=dict)
    currency: str = "EUR"
    version: int = 0

    @property
    def total_cents(self) -> int:
        return sum(i.subtotal_cents for i in self.items.values())

    @property
    def item_count(self) -> int:
        return sum(i.quantity for i in self.items.values())

    def _with(self, items: dict[str, CartItem]) -> "Cart":
        return replace(self, items=items)

    def add_item(self, sku: str, quantity: int, unit_price_cents: int) -> "Cart":
        _check_qty(quantity, allow_zero=False)
        items = dict(self.items)
        current = items.get(sku)
        new_qty = quantity + (current.quantity if current else 0)
        if new_qty > MAX_QTY_PER_ITEM:
            raise CartError(f"máximo {MAX_QTY_PER_ITEM} unidades por producto")
        if current is None and len(items) >= MAX_DISTINCT_ITEMS:
            raise CartError(f"máximo {MAX_DISTINCT_ITEMS} productos distintos")
        # el precio se refresca con el del catálogo en cada alta
        items[sku] = CartItem(sku, new_qty, unit_price_cents)
        return self._with(items)

    def set_quantity(self, sku: str, quantity: int) -> "Cart":
        _check_qty(quantity, allow_zero=True)
        if sku not in self.items:
            raise ProductNotFound(sku)
        if quantity == 0:
            return self.remove_item(sku)
        items = dict(self.items)
        items[sku] = replace(items[sku], quantity=quantity)
        return self._with(items)

    def remove_item(self, sku: str) -> "Cart":
        items = dict(self.items)
        items.pop(sku, None)  # idempotente
        return self._with(items)

    def clear(self) -> "Cart":
        return self._with({})

    # --- serialización ---
    def to_dict(self) -> dict:
        return {"id": self.id, "currency": self.currency, "version": self.version,
                "items": [vars(i) | {"subtotal_cents": i.subtotal_cents} for i in self.items.values()],
                "item_count": self.item_count, "total_cents": self.total_cents}

    @staticmethod
    def from_dict(d: dict) -> "Cart":
        items = {i["sku"]: CartItem(i["sku"], i["quantity"], i["unit_price_cents"]) for i in d["items"]}
        return Cart(d["id"], items, d.get("currency", "EUR"), d["version"])


def _check_qty(q: int, allow_zero: bool) -> None:
    if not isinstance(q, int) or isinstance(q, bool) or q < (0 if allow_zero else 1):
        raise CartError("cantidad inválida")
