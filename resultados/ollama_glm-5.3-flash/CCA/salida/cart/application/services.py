from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation
from typing import Optional

from ..domain.events import (
    EVENT_CART_CHECKED_OUT,
    EVENT_CART_CLEARED,
    EVENT_CART_CREATED,
    EVENT_ITEM_ADDED,
    EVENT_ITEM_REMOVED,
    EVENT_ITEM_UPDATED,
    CartEvent,
)
from ..domain.exceptions import InvalidProductError
from ..domain.models import Cart, Product
from .ports import CartRepository, EventPublisher, ProductRepository


class CartService:
    def __init__(
        self,
        carts: CartRepository,
        products: ProductRepository,
        publisher: Optional[EventPublisher] = None,
    ) -> None:
        self._carts = carts
        self._products = products
        self._publisher = publisher

    def _publish(self, event: CartEvent) -> None:
        if self._publisher is not None:
            self._publisher.publish(event)

    def _mutate(self, cart_id: str, mutator) -> tuple[Cart, object]:
        captured: dict[str, object] = {}

        def wrapper(cart: Cart) -> None:
            result = mutator(cart)
            if result is not None:
                captured["result"] = result

        updated = self._carts.update(cart_id, wrapper)
        return updated, captured.get("result")

    def create_product(self, name: str, price, product_id: Optional[str] = None) -> Product:
        try:
            amount = Decimal(str(price))
        except (InvalidOperation, TypeError, ValueError):
            raise InvalidProductError("price must be a valid number") from None
        if not amount.is_finite():
            raise InvalidProductError("price must be a finite number")
        product = Product(product_id or uuid.uuid4().hex, name, amount)
        return self._products.add(product)

    def get_product(self, product_id: str) -> Product:
        return self._products.get(product_id)

    def list_products(self, limit: int = 100, offset: int = 0) -> list[Product]:
        return self._products.list(limit=limit, offset=offset)

    def delete_product(self, product_id: str) -> None:
        self._products.delete(product_id)

    def create_cart(self) -> dict:
        cart = Cart()
        self._carts.create(cart)
        self._publish(CartEvent(EVENT_CART_CREATED, cart.id))
        return cart.snapshot()

    def get_cart(self, cart_id: str) -> dict:
        return self._carts.get(cart_id).snapshot()

    def delete_cart(self, cart_id: str) -> None:
        self._carts.delete(cart_id)

    def add_item(self, cart_id: str, product_id: str, quantity: int) -> dict:
        product = self._products.get(product_id)
        updated, result = self._mutate(cart_id, lambda c: c.add_item(product, quantity))
        item = result
        self._publish(
            CartEvent(
                EVENT_ITEM_ADDED,
                cart_id,
                {
                    "product_id": item.product_id,
                    "name": item.name,
                    "quantity": item.quantity,
                    "line_total": str(item.line_total),
                },
            )
        )
        return updated.snapshot()

    def update_item(self, cart_id: str, product_id: str, quantity: int) -> dict:
        updated, item = self._mutate(cart_id, lambda c: c.update_quantity(product_id, quantity))
        self._publish(
            CartEvent(
                EVENT_ITEM_UPDATED,
                cart_id,
                {
                    "product_id": item.product_id,
                    "quantity": item.quantity,
                    "line_total": str(item.line_total),
                },
            )
        )
        return updated.snapshot()

    def remove_item(self, cart_id: str, product_id: str) -> dict:
        updated, _ = self._mutate(cart_id, lambda c: c.remove_item(product_id))
        self._publish(CartEvent(EVENT_ITEM_REMOVED, cart_id, {"product_id": product_id}))
        return updated.snapshot()

    def clear_cart(self, cart_id: str) -> dict:
        updated, _ = self._mutate(cart_id, lambda c: c.clear())
        self._publish(CartEvent(EVENT_CART_CLEARED, cart_id))
        return updated.snapshot()

    def checkout_cart(self, cart_id: str) -> dict:
        updated, _ = self._mutate(cart_id, lambda c: c.checkout())
        self._publish(
            CartEvent(
                EVENT_CART_CHECKED_OUT,
                cart_id,
                {
                    "total": str(updated.total()),
                    "item_count": updated.item_count(),
                    "total_units": updated.total_units(),
                },
            )
        )
        return updated.snapshot()
