"""Puertos (interfaces) de la arquitectura hexagonal.

El caso de uso depende de estas abstracciones, no de implementaciones
concretas: cualquier repositorio (memoria, SQL, Redis, HTTP...) o catálogo
que cumpla el protocolo sirve sin tocar la lógica de negocio.
"""
from __future__ import annotations

from typing import Iterable, Protocol

from ..domain.entities import Cart, Product
from ..domain.value_objects import SKU


class CartRepository(Protocol):
    """Persistencia de carritos."""

    def get(self, cart_id: str) -> Cart | None: ...
    def save(self, cart: Cart) -> None: ...
    def delete(self, cart_id: str) -> None: ...
    def list_ids(self) -> list[str]: ...


class ProductCatalog(Protocol):
    """Catálogo de productos (solo lectura para el carrito)."""

    def get(self, sku: SKU | str) -> Product | None: ...
    def list(self) -> Iterable[Product]: ...
