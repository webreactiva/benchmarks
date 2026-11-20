"""Adaptadores de infraestructura: catálogo y repositorios de carritos.

- ``InMemoryProductCatalog`` / ``InMemoryCartRepository``: para tests y
  procesos efímeros.
- ``SqliteCartRepository``: persistencia real en SQLite (JSON por carrito),
  válida para despliegues que compartan la base de datos.

Cualquier otro adaptador (Redis, PostgreSQL, API externa...) solo tiene que
cumplir los protocolos de ``cart.application.ports``.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable

from ..domain.entities import Cart, Product
from ..domain.exceptions import ProductNotFound
from ..domain.value_objects import SKU


def _as_sku(value: SKU | str) -> SKU:
    return value if isinstance(value, SKU) else SKU(str(value))


class InMemoryProductCatalog:
    """Catálogo en memoria, seguro entre hilos."""

    def __init__(self, products: Iterable[Product] = ()) -> None:
        self._products: dict[SKU, Product] = {}
        self._lock = threading.Lock()
        for product in products:
            self.add(product)

    def add(self, product: Product) -> None:
        with self._lock:
            self._products[product.sku] = product

    def get(self, sku: SKU | str) -> Product | None:
        with self._lock:
            return self._products.get(_as_sku(sku))

    def list(self) -> list[Product]:
        with self._lock:
            return sorted(self._products.values(), key=lambda p: p.sku.value)

    def __len__(self) -> int:
        with self._lock:
            return len(self._products)


class InMemoryCartRepository:
    """Repositorio de carritos en memoria, seguro entre hilos."""

    def __init__(self) -> None:
        self._carts: dict[str, Cart] = {}
        self._lock = threading.Lock()

    def get(self, cart_id: str) -> Cart | None:
        with self._lock:
            return self._carts.get(cart_id)

    def save(self, cart: Cart) -> None:
        with self._lock:
            self._carts[cart.id] = cart

    def delete(self, cart_id: str) -> None:
        with self._lock:
            self._carts.pop(cart_id, None)

    def list_ids(self) -> list[str]:
        with self._lock:
            return sorted(self._carts)

    def __len__(self) -> int:
        with self._lock:
            return len(self._carts)


class SqliteCartRepository:
    """Repositorio persistente en SQLite.

    Cada carrito se guarda como una fila JSON, así que el esquema no cambia
    si evoluciona el dominio. ``product_resolver`` reconstruye los productos
    (p. ej. ``catalogo.get``) al leer.
    """

    def __init__(
        self,
        path: str | Path = ":memory:",
        product_resolver: Callable[[SKU], Product] | None = None,
    ) -> None:
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS carts ("
            "  id TEXT PRIMARY KEY,"
            "  data TEXT NOT NULL,"
            "  updated_at TEXT NOT NULL"
            ")"
        )
        self._conn.commit()
        self._lock = threading.Lock()
        if product_resolver is None:

            def product_resolver(sku: SKU) -> Product:
                raise ProductNotFound(f"Sin resolvedor de productos para {sku}")

        self._resolve = product_resolver

    def get(self, cart_id: str) -> Cart | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT data FROM carts WHERE id = ?", (cart_id,)
            ).fetchone()
        if row is None:
            return None
        return Cart.from_dict(json.loads(row[0]), self._resolve)

    def save(self, cart: Cart) -> None:
        payload = json.dumps(cart.to_dict(), ensure_ascii=False)
        ts = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._conn.execute(
                "INSERT INTO carts (id, data, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET data = excluded.data, "
                "updated_at = excluded.updated_at",
                (cart.id, payload, ts),
            )
            self._conn.commit()

    def delete(self, cart_id: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM carts WHERE id = ?", (cart_id,))
            self._conn.commit()

    def list_ids(self) -> list[str]:
        with self._lock:
            rows = self._conn.execute("SELECT id FROM carts ORDER BY id").fetchall()
        return [row[0] for row in rows]

    def close(self) -> None:
        with self._lock:
            self._conn.close()
