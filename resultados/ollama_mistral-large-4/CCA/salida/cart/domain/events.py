"""Eventos de dominio y bus de eventos.

Permiten extender el sistema (auditoría, notificaciones, métricas, pedidos...)
sin modificar la lógica del carrito: basta con suscribir un handler.
"""
from __future__ import annotations

import logging
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Iterable

from .value_objects import Money

logger = logging.getLogger("cart.events")


@dataclass(frozen=True)
class DomainEvent:
    """Evento base; ``occurred_at`` se rellena solo y es solo-keyword."""

    occurred_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc), kw_only=True
    )


@dataclass(frozen=True)
class CartCreated(DomainEvent):
    cart_id: str


@dataclass(frozen=True)
class ItemAdded(DomainEvent):
    cart_id: str
    sku: str
    quantity: int
    new_quantity: int


@dataclass(frozen=True)
class ItemQuantityUpdated(DomainEvent):
    cart_id: str
    sku: str
    quantity: int


@dataclass(frozen=True)
class ItemRemoved(DomainEvent):
    cart_id: str
    sku: str


@dataclass(frozen=True)
class CartCleared(DomainEvent):
    cart_id: str


@dataclass(frozen=True)
class CartCheckedOut(DomainEvent):
    cart_id: str
    total: Money
    item_count: int


@dataclass(frozen=True)
class CartMerged(DomainEvent):
    source_id: str
    target_id: str
    moved_items: int


EventHandler = Callable[[DomainEvent], None]


class EventBus:
    """Bus de eventos en proceso, seguro entre hilos.

    Los handlers se ejecutan de forma aislada: si uno falla, se registra el
    error y no se interrumpe la operación del carrito ni la del resto de handlers.
    Se puede suscribir a ``DomainEvent`` para recibir todos los eventos, o a un
    tipo concreto (p. ej. ``ItemAdded``).
    """

    def __init__(self) -> None:
        self._handlers: dict[type, list[EventHandler]] = defaultdict(list)
        self._lock = threading.Lock()

    def subscribe(self, event_type: type[DomainEvent], handler: EventHandler) -> None:
        with self._lock:
            self._handlers[event_type].append(handler)

    def publish(self, event: DomainEvent) -> None:
        with self._lock:
            handlers: list[EventHandler] = []
            # Recorre el MRO para que suscribirse a DomainEvent capture todo.
            for cls in type(event).__mro__:
                handlers.extend(self._handlers.get(cls, ()))
        for handler in handlers:
            try:
                handler(event)
            except Exception:
                logger.exception("Error en handler de %s", type(event).__name__)

    def publish_all(self, events: Iterable[DomainEvent]) -> None:
        for event in events:
            self.publish(event)
