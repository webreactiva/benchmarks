"""Servicio de aplicación: casos de uso del carrito.

Orquesta el dominio con los puertos (repositorio, catálogo), publica los
eventos de dominio tras persistir y serializa las mutaciones con un lock
para que sea seguro bajo concurrencia (varios hilos/pedidos a la vez).
"""
from __future__ import annotations

import threading

from ..domain.entities import Cart, Product
from ..domain.events import CartCheckedOut, CartCreated, CartMerged, DomainEvent, EventBus
from ..domain.exceptions import CartNotFound, EmptyCart, ProductNotFound
from ..domain.value_objects import Quantity, SKU
from .ports import CartRepository, ProductCatalog
from .pricing import PricingEngine, Receipt

DEFAULT_MAX_ITEMS = 100


class CartService:
    """Fachada de casos de uso: crear/consultar carritos, añadir, quitar,
    modificar cantidades, tasar, hacer checkout y fusionar carritos."""

    def __init__(
        self,
        repository: CartRepository,
        catalog: ProductCatalog,
        event_bus: EventBus | None = None,
        pricing_engine: PricingEngine | None = None,
        max_items: int = DEFAULT_MAX_ITEMS,
    ) -> None:
        self.repository = repository
        self.catalog = catalog
        self.event_bus = event_bus or EventBus()
        self.pricing_engine = pricing_engine or PricingEngine()
        self.max_items = max_items
        self._lock = threading.RLock()

    # ------------------------------------------------------------- carritos
    def create_cart(self) -> Cart:
        cart = Cart(max_items=self.max_items)
        cart.record_event(CartCreated(cart.id))
        self._save(cart)
        return cart

    def get_cart(self, cart_id: str) -> Cart:
        cart = self.repository.get(cart_id)
        if cart is None:
            raise CartNotFound(f"No existe el carrito {cart_id!r}")
        return cart

    def list_carts(self) -> list[str]:
        return self.repository.list_ids()

    def delete_cart(self, cart_id: str) -> None:
        with self._lock:
            self.get_cart(cart_id)  # valida que existe
            self.repository.delete(cart_id)

    # ------------------------------------------------------------- artículos
    def add_item(self, cart_id: str, sku: SKU | str, quantity: int = 1) -> Cart:
        with self._lock:
            cart = self.get_cart(cart_id)
            product = self._require_product(sku)
            cart.add_item(product, Quantity(quantity))
            self._save(cart)
            return cart

    def update_quantity(self, cart_id: str, sku: SKU | str, quantity: int) -> Cart:
        with self._lock:
            cart = self.get_cart(cart_id)
            key = sku if isinstance(sku, SKU) else SKU(str(sku))
            cart.update_quantity(key, Quantity(quantity))
            self._save(cart)
            return cart

    def remove_item(self, cart_id: str, sku: SKU | str) -> Cart:
        with self._lock:
            cart = self.get_cart(cart_id)
            key = sku if isinstance(sku, SKU) else SKU(str(sku))
            cart.remove_item(key)
            self._save(cart)
            return cart

    def clear_cart(self, cart_id: str) -> Cart:
        with self._lock:
            cart = self.get_cart(cart_id)
            cart.clear()
            self._save(cart)
            return cart

    # ------------------------------------------------------------- precios
    def get_receipt(self, cart_id: str) -> Receipt:
        """Tasa el carrito sin modificarlo (vista previa del total)."""
        return self.pricing_engine.price(self.get_cart(cart_id))

    def checkout(self, cart_id: str) -> Receipt:
        """Cierra la compra: tasa el carrito, emite ``CartCheckedOut`` y lo vacía."""
        with self._lock:
            cart = self.get_cart(cart_id)
            if cart.is_empty:
                raise EmptyCart("No se puede hacer checkout de un carrito vacío")
            receipt = self.pricing_engine.price(cart)
            cart.record_event(CartCheckedOut(cart.id, receipt.total, cart.item_count))
            cart.clear()
            self._save(cart)
            return receipt

    def merge_carts(self, source_id: str, target_id: str) -> Cart:
        """Fusiona el carrito ``source_id`` dentro de ``target_id`` y elimina el origen.

        Respeta los límites del carrito destino y el stock disponible.
        """
        if source_id == target_id:
            raise ValueError("No se puede fusionar un carrito consigo mismo")
        with self._lock:
            source = self.get_cart(source_id)
            target = self.get_cart(target_id)
            moved = 0
            for item in source.items:
                product = self._require_product(item.sku)
                target.add_item(product, item.quantity)
                moved += 1
            target.record_event(CartMerged(source_id, target_id, moved))
            self.repository.delete(source_id)
            self._save(target)
            return target

    # ------------------------------------------------------------- privados
    def _require_product(self, sku: SKU | str) -> Product:
        product = self.catalog.get(sku)
        if product is None:
            raise ProductNotFound(f"Producto no encontrado: {sku}")
        return product

    def _save(self, cart: Cart) -> None:
        """Persiste y luego publica los eventos acumulados (drain)."""
        self.repository.save(cart)
        events: list[DomainEvent] = cart.drain_events()
        self.event_bus.publish_all(events)
