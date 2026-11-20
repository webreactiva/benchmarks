"""
Servicio de inventario desacoplado.

Permite reservar/liberar stock al añadir al carrito (opcional según estrategia).
Escalable: en prod sería un microservicio con DB propia + eventual consistency.
"""
from __future__ import annotations

import threading
from abc import ABC, abstractmethod
from typing import Dict, Optional

from .models import Product, Money
from .exceptions import ProductNotFoundError, InsufficientStockError


class InventoryService(ABC):
    @abstractmethod
    def get_product(self, product_id: str) -> Product:
        ...

    @abstractmethod
    def check_stock(self, product_id: str, quantity: int) -> bool:
        ...

    @abstractmethod
    def reserve(self, product_id: str, quantity: int) -> None:
        ...

    @abstractmethod
    def release(self, product_id: str, quantity: int) -> None:
        ...

    @abstractmethod
    def list_products(self) -> Dict[str, Product]:
        ...


class InMemoryInventory(InventoryService):
    def __init__(self, products: Optional[Dict[str, Product]] = None):
        self._products: Dict[str, Product] = products or {}
        self._lock = threading.RLock()
        # Reservas activas: product_id -> cantidad reservada (no restada aún del stock real hasta checkout)
        self._reservations: Dict[str, int] = {}

    def add_product(self, product: Product) -> None:
        with self._lock:
            self._products[product.id] = product

    def get_product(self, product_id: str) -> Product:
        with self._lock:
            p = self._products.get(product_id)
            if not p:
                raise ProductNotFoundError(f"Producto {product_id} no encontrado")
            # devolver copia
            return Product.from_dict(p.to_dict())

    def check_stock(self, product_id: str, quantity: int) -> bool:
        with self._lock:
            p = self._products.get(product_id)
            if not p:
                raise ProductNotFoundError(product_id)
            reserved = self._reservations.get(product_id, 0)
            return (p.stock - reserved) >= quantity

    def reserve(self, product_id: str, quantity: int) -> None:
        with self._lock:
            if not self.check_stock(product_id, quantity):
                p = self._products[product_id]
                reserved = self._reservations.get(product_id, 0)
                available = p.stock - reserved
                raise InsufficientStockError(product_id, quantity, available)
            self._reservations[product_id] = self._reservations.get(product_id, 0) + quantity

    def release(self, product_id: str, quantity: int) -> None:
        with self._lock:
            current = self._reservations.get(product_id, 0)
            self._reservations[product_id] = max(0, current - quantity)
            if self._reservations[product_id] == 0:
                self._reservations.pop(product_id, None)

    def confirm_purchase(self, product_id: str, quantity: int) -> None:
        """Al hacer checkout: restar del stock real y liberar reserva."""
        with self._lock:
            p = self._products.get(product_id)
            if not p:
                raise ProductNotFoundError(product_id)
            if p.stock < quantity:
                raise InsufficientStockError(product_id, quantity, p.stock)
            p.stock -= quantity
            self.release(product_id, quantity)

    def list_products(self) -> Dict[str, Product]:
        with self._lock:
            return {k: Product.from_dict(v.to_dict()) for k, v in self._products.items()}

    def available_stock(self, product_id: str) -> int:
        with self._lock:
            p = self._products[product_id]
            return p.stock - self._reservations.get(product_id, 0)

    @classmethod
    def with_sample_data(cls) -> InMemoryInventory:
        inv = cls()
        samples = [
            Product("P001", "Laptop Pro 14\"", Money("999.99"), stock=50, category="electronics", metadata={"brand": "TechBrand"}),
            Product("P002", "Ratón Inalámbrico", Money("29.99"), stock=200, category="electronics"),
            Product("P003", "Teclado Mecánico", Money("79.50"), stock=100, category="electronics"),
            Product("P004", "Camiseta Algodón", Money("19.99"), stock=500, category="apparel"),
            Product("P005", "Zapatillas Running", Money("89.99"), stock=80, category="apparel"),
            Product("P006", "Libro Python Avanzado", Money("39.00"), stock=30, category="books"),
            Product("P007", "Auriculares BT", Money("59.99"), stock=120, category="electronics"),
            Product("P008", "Mochila Urbana", Money("45.00"), stock=60, category="accessories"),
        ]
        for p in samples:
            inv.add_product(p)
        return inv
