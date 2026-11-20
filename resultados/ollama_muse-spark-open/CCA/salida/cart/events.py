"""
Sistema de eventos desacoplado (Observer / Pub-Sub).

Permite escalabilidad: listeners pueden ser async, enviar a Kafka/RabbitMQ, etc.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Callable, Dict, List, Any, Optional
import uuid


class EventType(str, Enum):
    CART_CREATED = "cart.created"
    ITEM_ADDED = "cart.item_added"
    ITEM_REMOVED = "cart.item_removed"
    ITEM_UPDATED = "cart.item_updated"
    CART_CLEARED = "cart.cleared"
    COUPON_APPLIED = "cart.coupon_applied"
    CHECKED_OUT = "cart.checked_out"
    CART_EXPIRED = "cart.expired"


@dataclass(slots=True)
class CartEvent:
    type: EventType
    cart_id: str
    payload: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "type": self.type.value,
            "cart_id": self.cart_id,
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat(),
        }


Listener = Callable[[CartEvent], None]


class EventBus:
    """Bus en memoria thread-safe. En prod se reemplazaría por broker externo."""

    def __init__(self):
        self._listeners: Dict[EventType, List[Listener]] = {}
        self._wildcard_listeners: List[Listener] = []
        self._lock = threading.RLock()
        self._history: List[CartEvent] = []
        self._max_history = 1000

    def subscribe(self, event_type: EventType, listener: Listener) -> None:
        with self._lock:
            self._listeners.setdefault(event_type, []).append(listener)

    def subscribe_all(self, listener: Listener) -> None:
        with self._lock:
            self._wildcard_listeners.append(listener)

    def publish(self, event: CartEvent) -> None:
        # Guardar historial
        with self._lock:
            self._history.append(event)
            if len(self._history) > self._max_history:
                self._history.pop(0)
            listeners = list(self._listeners.get(event.type, []))
            wildcards = list(self._wildcard_listeners)

        # Notificar fuera del lock para no bloquear
        for fn in listeners + wildcards:
            try:
                fn(event)
            except Exception as e:
                # No romper flujo por listener fallido; log simple
                print(f"[EventBus] listener error {e} for {event.type}")

    def history(self, cart_id: Optional[str] = None, event_type: Optional[EventType] = None) -> List[CartEvent]:
        with self._lock:
            result = list(self._history)
        if cart_id:
            result = [e for e in result if e.cart_id == cart_id]
        if event_type:
            result = [e for e in result if e.type == event_type]
        return result

    def clear_history(self) -> None:
        with self._lock:
            self._history.clear()
