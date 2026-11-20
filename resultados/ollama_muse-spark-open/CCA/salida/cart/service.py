"""
CartService - Capa de aplicación / Orquestación.

Responsabilidades:
  - Coordinar Aggregate + Storage + Inventory + Pricing + Events
  - Control de concurrencia (optimistic locking + retry)
  - Validaciones transaccionales
  - Idempotencia y manejo de expiración

Diseño escalable:
  - Stateless: puede haber N instancias detrás de un load balancer.
  - Todas las dependencias inyectadas por constructor (DI).
  - Operaciones atómicas por cart_id.
"""
from __future__ import annotations

import threading
import time
from datetime import timedelta, datetime, timezone
from decimal import Decimal
from typing import Optional, Dict, Any

from .models import Cart, CartStatus, Money
from .cart import CartAggregate
from .storage import CartStorage
from .inventory import InventoryService
from .pricing import PricingEngine, PriceBreakdown
from .events import EventBus, CartEvent, EventType
from .exceptions import CartNotFoundError, CartExpiredError, InsufficientStockError


class CartService:
    def __init__(
        self,
        storage: CartStorage,
        inventory: InventoryService,
        pricing: Optional[PricingEngine] = None,
        event_bus: Optional[EventBus] = None,
        reserve_stock: bool = True,  # si True, reserva al añadir
        max_retries: int = 3,
    ):
        self.storage = storage
        self.inventory = inventory
        self.pricing = pricing or PricingEngine()
        self.events = event_bus or EventBus()
        self.reserve_stock = reserve_stock
        self.max_retries = max_retries
        # Locks por cart_id para serializar escritura concurrente en misma instancia
        # (en distribuido se usaría Redis lock / DB row lock)
        self._locks: Dict[str, threading.RLock] = {}
        self._locks_lock = threading.Lock()

    def _lock_for(self, cart_id: str) -> threading.RLock:
        with self._locks_lock:
            if cart_id not in self._locks:
                self._locks[cart_id] = threading.RLock()
            return self._locks[cart_id]

    # -- CRUD Carrito ------------------------------------------------------
    def create_cart(
        self,
        user_id: Optional[str] = None,
        currency: str = "EUR",
        ttl: Optional[timedelta] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Cart:
        cart = Cart.create(user_id=user_id, currency=currency, ttl=ttl)
        if metadata:
            cart.metadata.update(metadata)
        self.storage.save(cart)
        self.events.publish(CartEvent(EventType.CART_CREATED, cart.id, {"user_id": user_id}))
        return cart

    def get_cart(self, cart_id: str) -> Cart:
        cart = self.storage.get(cart_id)
        if not cart:
            raise CartNotFoundError(f"Carrito {cart_id} no encontrado")
        if cart.is_expired and cart.status == CartStatus.ACTIVE:
            cart.status = CartStatus.EXPIRED
            self.storage.save(cart)
            self.events.publish(CartEvent(EventType.CART_EXPIRED, cart.id))
            raise CartExpiredError(f"Carrito {cart_id} expirado")
        return cart

    def delete_cart(self, cart_id: str) -> None:
        cart = self.storage.get(cart_id)
        if not cart:
            return
        # liberar reservas
        if self.reserve_stock:
            for item in cart.items.values():
                try:
                    self.inventory.release(item.product_id, item.quantity)
                except Exception:
                    pass
        self.storage.delete(cart_id)

    # -- Operaciones con retry optimista -----------------------------------
    def _execute_with_retry(self, cart_id: str, operation):
        """
        Ejecuta `operation(aggregate)` con retry por ConcurrencyError.
        operation debe mutar el aggregate y puede lanzar InsufficientStock etc.
        """
        last_exc = None
        for attempt in range(self.max_retries):
            cart = self.get_cart(cart_id)
            expected_version = cart.version
            agg = CartAggregate(cart)

            # ejecutar lógica de dominio
            result = operation(agg)

            # intentar guardar con CAS
            try:
                with self._lock_for(cart_id):
                    # re-leer dentro del lock por si otra thread en misma instancia escribió
                    fresh = self.storage.get(cart_id)
                    if fresh and fresh.version != expected_version:
                        raise CartNotFoundError("retry")  # forzar retry via excepción controlada
                    self.storage.save(agg.cart, expected_version=expected_version)
                return result, agg.cart
            except Exception as e:
                # si es error de concurrencia, retry
                from .exceptions import ConcurrencyError
                if isinstance(e, ConcurrencyError) or "retry" in str(e) or "Conflicto" in str(e):
                    last_exc = e
                    time.sleep(0.01 * (attempt + 1))  # backoff
                    continue
                raise
        raise last_exc or RuntimeError("Max retries excedido")

    # -- API pública -------------------------------------------------------
    def add_item(self, cart_id: str, product_id: str, quantity: int = 1) -> Cart:
        product = self.inventory.get_product(product_id)

        if self.reserve_stock:
            # verificar y reservar antes de mutar carrito
            self.inventory.reserve(product_id, quantity)

        def op(agg: CartAggregate):
            try:
                item = agg.add_item(product, quantity)
                self.events.publish(CartEvent(EventType.ITEM_ADDED, cart_id, {
                    "product_id": product_id, "quantity": quantity, "total_items": agg.cart.total_items
                }))
                return item
            except Exception as e:
                # rollback reserva si falla dominio
                if self.reserve_stock:
                    try:
                        self.inventory.release(product_id, quantity)
                    except Exception:
                        pass
                raise e

        try:
            _, cart = self._execute_with_retry(cart_id, op)
        except Exception as e:
            # si ya habíamos reservado y falló por concurrencia, liberar?
            # En retry loop ya se manejó; solo si es error no-retry lo liberamos
            raise e

        return cart

    def update_quantity(self, cart_id: str, product_id: str, quantity: int) -> Cart:
        # Obtener cart actual para calcular delta de stock
        cart = self.get_cart(cart_id)
        old_qty = cart.items.get(product_id).quantity if product_id in cart.items else 0
        delta = quantity - old_qty

        if self.reserve_stock and delta > 0:
            self.inventory.reserve(product_id, delta)
        elif self.reserve_stock and delta < 0:
            self.inventory.release(product_id, -delta)

        def op(agg: CartAggregate):
            try:
                agg.update_quantity(product_id, quantity)
                self.events.publish(CartEvent(EventType.ITEM_UPDATED, cart_id, {
                    "product_id": product_id, "quantity": quantity
                }))
            except Exception as e:
                # rollback
                if self.reserve_stock:
                    if delta > 0:
                        self.inventory.release(product_id, delta)
                    elif delta < 0:
                        self.inventory.reserve(product_id, -delta)
                raise

        _, cart = self._execute_with_retry(cart_id, op)
        return cart

    def remove_item(self, cart_id: str, product_id: str) -> Cart:
        cart = self.get_cart(cart_id)
        qty = cart.items.get(product_id).quantity if product_id in cart.items else 0

        def op(agg: CartAggregate):
            agg.remove_item(product_id)
            self.events.publish(CartEvent(EventType.ITEM_REMOVED, cart_id, {"product_id": product_id}))

        _, new_cart = self._execute_with_retry(cart_id, op)

        if self.reserve_stock and qty:
            self.inventory.release(product_id, qty)

        return new_cart

    def clear_cart(self, cart_id: str) -> Cart:
        cart = self.get_cart(cart_id)
        items_snapshot = list(cart.items.values())

        def op(agg: CartAggregate):
            agg.clear()
            self.events.publish(CartEvent(EventType.CART_CLEARED, cart_id))

        _, new_cart = self._execute_with_retry(cart_id, op)

        if self.reserve_stock:
            for item in items_snapshot:
                self.inventory.release(item.product_id, item.quantity)

        return new_cart

    def apply_coupon(self, cart_id: str, coupon_code: str) -> Cart:
        def op(agg: CartAggregate):
            agg.apply_coupon(coupon_code)
            self.events.publish(CartEvent(EventType.COUPON_APPLIED, cart_id, {"coupon": coupon_code}))

        _, cart = self._execute_with_retry(cart_id, op)
        return cart

    def remove_coupon(self, cart_id: str) -> Cart:
        def op(agg: CartAggregate):
            agg.remove_coupon()

        _, cart = self._execute_with_retry(cart_id, op)
        return cart

    # -- Checkout & Pricing ------------------------------------------------
    def get_pricing(self, cart_id: str) -> PriceBreakdown:
        cart = self.get_cart(cart_id)
        return self.pricing.calculate(cart)

    def checkout(self, cart_id: str) -> Dict[str, Any]:
        """
        Proceso de checkout:
          1. Validar carrito activo y no vacío
          2. Calcular precio final
          3. Confirmar compra en inventario (descontar stock)
          4. Marcar carrito como CHECKED_OUT
          5. Emitir evento
        """
        cart = self.get_cart(cart_id)
        if cart.is_empty():
            raise ValueError("No se puede hacer checkout de carrito vacío")

        pricing = self.pricing.calculate(cart)

        # Confirmar en inventario
        for item in cart.items.values():
            # Si usamos reservas, confirmar; si no, verificar stock y descontar directo
            if self.reserve_stock:
                # confirmar: ya reservado, ahora restar stock real
                if hasattr(self.inventory, "confirm_purchase"):
                    self.inventory.confirm_purchase(item.product_id, item.quantity)
            else:
                if not self.inventory.check_stock(item.product_id, item.quantity):
                    raise InsufficientStockError(item.product_id, item.quantity, 0)
                if hasattr(self.inventory, "confirm_purchase"):
                    self.inventory.confirm_purchase(item.product_id, item.quantity)

        cart.status = CartStatus.CHECKED_OUT
        cart.updated_at = datetime.now(timezone.utc)
        cart.version += 1
        self.storage.save(cart)

        self.events.publish(CartEvent(EventType.CHECKED_OUT, cart_id, {
            "total": str(pricing.total.amount),
            "items": cart.total_items,
        }))

        return {
            "cart": cart.to_dict(),
            "pricing": pricing.to_dict(),
            "order_id": f"ORD-{cart.id[:8].upper()}",
        }

    # -- Utilidades --------------------------------------------------------
    def merge_carts(self, target_cart_id: str, source_cart_id: str) -> Cart:
        """Fusiona source en target (útil para login: carrito anónimo -> usuario)."""
        source = self.get_cart(source_cart_id)
        target = self.get_cart(target_cart_id)

        for item in source.items.values():
            self.add_item(target_cart_id, item.product_id, item.quantity)

        self.delete_cart(source_cart_id)
        return self.get_cart(target_cart_id)

    def get_user_carts(self, user_id: str):
        return self.storage.list_by_user(user_id)
