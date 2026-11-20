from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

EVENT_CART_CREATED = "cart.created"
EVENT_ITEM_ADDED = "cart.item_added"
EVENT_ITEM_UPDATED = "cart.quantity_updated"
EVENT_ITEM_REMOVED = "cart.item_removed"
EVENT_CART_CLEARED = "cart.cleared"
EVENT_CART_CHECKED_OUT = "cart.checked_out"


@dataclass(frozen=True)
class CartEvent:
    type: str
    cart_id: str
    payload: dict[str, Any] = field(default_factory=dict)
    occurred_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "cart_id": self.cart_id,
            "payload": dict(self.payload),
            "occurred_at": self.occurred_at,
        }
