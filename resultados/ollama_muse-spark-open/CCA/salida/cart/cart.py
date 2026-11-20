"""
CartAggregate - Lógica de dominio pura (sin I/O).
Encapsula invariantes del carrito.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict

from .models import Cart, CartItem, Product, CartStatus, Money
from .exceptions import (
    InvalidQuantityError,
    CartLimitExceededError,
    CartExpiredError,
)


# Límites configurables para escalabilidad / protección
DEFAULT_MAX_UNIQUE_ITEMS = 100
DEFAULT_MAX_QUANTITY_PER_ITEM = 99
DEFAULT_MAX_TOTAL_ITEMS = 500


class CartAggregate:
    """Wrapper con comportamiento sobre Cart (DDD Aggregate)."""

    def __init__(
        self,
        cart: Cart,
        max_unique_items: int = DEFAULT_MAX_UNIQUE_ITEMS,
        max_quantity_per_item: int = DEFAULT_MAX_QUANTITY_PER_ITEM,
        max_total_items: int = DEFAULT_MAX_TOTAL_ITEMS,
    ):
        self.cart = cart
        self.max_unique_items = max_unique_items
        self.max_quantity_per_item = max_quantity_per_item
        self.max_total_items = max_total_items

    # -- Guards ------------------------------------------------------------
    def _assert_active(self):
        if self.cart.status != CartStatus.ACTIVE:
            raise CartExpiredError(f"Carrito {self.cart.id} no está activo: {self.cart.status}")
        if self.cart.is_expired:
            self.cart.status = CartStatus.EXPIRED
            raise CartExpiredError(f"Carrito {self.cart.id} expirado")

    def _touch(self):
        self.cart.updated_at = datetime.now(timezone.utc)
        self.cart.version += 1

    # -- Operaciones -------------------------------------------------------
    def add_item(self, product: Product, quantity: int = 1) -> CartItem:
        self._assert_active()
        if quantity <= 0:
            raise InvalidQuantityError("quantity debe ser > 0")
        if quantity > self.max_quantity_per_item:
            raise CartLimitExceededError(f"Máximo {self.max_quantity_per_item} por producto")
        if not product.active:
            raise InvalidQuantityError(f"Producto {product.id} inactivo")

        # Verificar límites globales
        existing_qty = self.cart.items[product.id].quantity if product.id in self.cart.items else 0
        new_qty = existing_qty + quantity
        if new_qty > self.max_quantity_per_item:
            raise CartLimitExceededError(
                f"Excede máximo por item: {new_qty} > {self.max_quantity_per_item}"
            )

        if product.id not in self.cart.items and len(self.cart.items) >= self.max_unique_items:
            raise CartLimitExceededError(f"Máximo {self.max_unique_items} items únicos")

        if self.cart.total_items + quantity > self.max_total_items:
            raise CartLimitExceededError(f"Máximo {self.max_total_items} unidades totales")

        if product.id in self.cart.items:
            item = self.cart.items[product.id]
            item.quantity = new_qty
            # actualizar precio por si cambió
            item.unit_price = product.price
            item.name = product.name
        else:
            item = CartItem(
                product_id=product.id,
                name=product.name,
                unit_price=product.price,
                quantity=quantity,
                category=product.category,
            )
            self.cart.items[product.id] = item

        self._touch()
        return item

    def update_quantity(self, product_id: str, quantity: int) -> CartItem | None:
        self._assert_active()
        if product_id not in self.cart.items:
            raise InvalidQuantityError(f"Producto {product_id} no está en el carrito")
        if quantity <= 0:
            # eliminar si <=0
            del self.cart.items[product_id]
            self._touch()
            return None
        if quantity > self.max_quantity_per_item:
            raise CartLimitExceededError(f"Máximo {self.max_quantity_per_item}")

        self.cart.items[product_id].quantity = quantity
        self._touch()
        return self.cart.items[product_id]

    def remove_item(self, product_id: str) -> None:
        self._assert_active()
        if product_id not in self.cart.items:
            return  # idempotente
        del self.cart.items[product_id]
        self._touch()

    def clear(self) -> None:
        self._assert_active()
        self.cart.items.clear()
        self.cart.coupon_code = None
        self._touch()

    def apply_coupon(self, coupon_code: str) -> None:
        self._assert_active()
        if not coupon_code or not coupon_code.strip():
            raise ValueError("coupon_code vacío")
        self.cart.coupon_code = coupon_code.strip().upper()
        self._touch()

    def remove_coupon(self) -> None:
        self.cart.coupon_code = None
        self._touch()

    def set_currency(self, currency: str) -> None:
        if self.cart.items:
            raise ValueError("No se puede cambiar moneda con items en el carrito")
        self.cart.currency = currency
        self._touch()

    def to_snapshot(self) -> dict:
        return self.cart.to_dict()
