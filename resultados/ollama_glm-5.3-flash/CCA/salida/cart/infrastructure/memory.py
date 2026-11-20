from __future__ import annotations

import copy
import threading
from typing import Callable, Iterable, Optional

from ..domain.exceptions import (
    CartNotFoundError,
    DuplicateCartError,
    DuplicateProductError,
    ProductNotFoundError,
)
from ..domain.models import Cart, Product
from ..domain.events import CartEvent


class InMemoryProductRepository:
    def __init__(self, initial: Iterable[Product] = ()) -> None:
        self._products: dict[str, Product] = {}
        self._lock = threading.RLock()
        for product in initial:
            self.add(product)

    def add(self, product: Product) -> Product:
        with self._lock:
            if product.id in self._products:
                raise DuplicateProductError(f"product {product.id} already exists")
            self._products[product.id] = product
            return product

    def get(self, product_id: str) -> Product:
        with self._lock:
            try:
                return self._products[product_id]
            except KeyError:
                raise ProductNotFoundError(f"product {product_id} not found") from None

    def list(self, limit: int = 100, offset: int = 0) -> list[Product]:
        with self._lock:
            products = list(self._products.values())
        return products[offset : offset + limit]

    def delete(self, product_id: str) -> None:
        with self._lock:
            try:
                del self._products[product_id]
            except KeyError:
                raise ProductNotFoundError(f"product {product_id} not found") from None


class InMemoryCartRepository:
    def __init__(self) -> None:
        self._carts: dict[str, Cart] = {}
        self._cart_locks: dict[str, threading.RLock] = {}
        self._registry_lock = threading.Lock()

    def _lock_for(self, cart_id: str) -> threading.RLock:
        with self._registry_lock:
            lock = self._cart_locks.get(cart_id)
            if lock is None:
                lock = threading.RLock()
                self._cart_locks[cart_id] = lock
            return lock

    def create(self, cart: Cart) -> Cart:
        lock = self._lock_for(cart.id)
        with lock:
            if cart.id in self._carts:
                raise DuplicateCartError(f"cart {cart.id} already exists")
            self._carts[cart.id] = copy.deepcopy(cart)
            return copy.deepcopy(self._carts[cart.id])

    def get(self, cart_id: str) -> Cart:
        lock = self._lock_for(cart_id)
        with lock:
            stored = self._carts.get(cart_id)
            if stored is None:
                raise CartNotFoundError(f"cart {cart_id} not found")
            return copy.deepcopy(stored)

    def exists(self, cart_id: str) -> bool:
        lock = self._lock_for(cart_id)
        with lock:
            return cart_id in self._carts

    def update(self, cart_id: str, mutator: Callable[[Cart], None]) -> Cart:
        lock = self._lock_for(cart_id)
        with lock:
            stored = self._carts.get(cart_id)
            if stored is None:
                raise CartNotFoundError(f"cart {cart_id} not found")
            working = copy.deepcopy(stored)
            mutator(working)
            self._carts[cart_id] = working
            return copy.deepcopy(working)

    def delete(self, cart_id: str) -> None:
        lock = self._lock_for(cart_id)
        with lock:
            if cart_id not in self._carts:
                raise CartNotFoundError(f"cart {cart_id} not found")
            del self._carts[cart_id]


class InMemoryEventPublisher:
    def __init__(self) -> None:
        self._subscribers: list[Callable[[CartEvent], None]] = []
        self._lock = threading.Lock()

    def subscribe(self, callback: Callable[[CartEvent], None]) -> Callable[[], None]:
        with self._lock:
            self._subscribers.append(callback)

        def unsubscribe() -> None:
            with self._lock:
                if callback in self._subscribers:
                    self._subscribers.remove(callback)

        return unsubscribe

    def publish(self, event: CartEvent) -> None:
        with self._lock:
            subscribers = tuple(self._subscribers)
        for callback in subscribers:
            callback(event)


def build_in_memory_service(publisher: Optional[InMemoryEventPublisher] = None):
    from ..application.services import CartService

    return CartService(
        carts=InMemoryCartRepository(),
        products=InMemoryProductRepository(),
        publisher=publisher if publisher is not None else InMemoryEventPublisher(),
    )
