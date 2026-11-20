"""
Modelos de dominio - Inmutables donde conviene, serializables.
Diseñado para escalabilidad: entidades ligeras, sin lógica de infraestructura.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Optional, Dict, Any


# ---------------------------------------------------------------------------
# Value Object: Money
# ---------------------------------------------------------------------------
@dataclass(frozen=True, slots=True)
class Money:
    amount: Decimal
    currency: str = "EUR"

    def __post_init__(self):
        # Normalizar a 2 decimales
        object.__setattr__(
            self, "amount",
            Decimal(self.amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        )
        if not self.currency or len(self.currency) != 3:
            raise ValueError(f"Moneda inválida: {self.currency}")

    def __add__(self, other: Money) -> Money:
        self._assert_same_currency(other)
        return Money(self.amount + other.amount, self.currency)

    def __sub__(self, other: Money) -> Money:
        self._assert_same_currency(other)
        return Money(self.amount - other.amount, self.currency)

    def __mul__(self, factor: int | float | Decimal) -> Money:
        return Money(self.amount * Decimal(str(factor)), self.currency)

    def __rmul__(self, factor: int | float | Decimal) -> Money:
        return self.__mul__(factor)

    def _assert_same_currency(self, other: Money):
        if self.currency != other.currency:
            raise ValueError(f"Monedas distintas: {self.currency} vs {other.currency}")

    def to_dict(self) -> Dict[str, Any]:
        return {"amount": str(self.amount), "currency": self.currency}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Money:
        return cls(Decimal(data["amount"]), data["currency"])

    def __str__(self) -> str:
        return f"{self.amount} {self.currency}"


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------
@dataclass(slots=True)
class Product:
    id: str
    name: str
    price: Money
    stock: int = 0
    category: str = "general"
    weight_kg: Decimal = Decimal("0.0")
    metadata: Dict[str, Any] = field(default_factory=dict)
    active: bool = True

    def __post_init__(self):
        if not self.id:
            raise ValueError("Product.id no puede estar vacío")
        if self.price.amount < Decimal("0"):
            raise ValueError("Precio no puede ser negativo")
        if self.stock < 0:
            raise ValueError("Stock no puede ser negativo")

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["price"] = self.price.to_dict()
        d["weight_kg"] = str(self.weight_kg)
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Product:
        data = dict(data)
        data["price"] = Money.from_dict(data["price"])
        data["weight_kg"] = Decimal(data["weight_kg"])
        return cls(**data)


# ---------------------------------------------------------------------------
# CartStatus
# ---------------------------------------------------------------------------
class CartStatus(str, Enum):
    ACTIVE = "active"
    ABANDONED = "abandoned"
    CHECKED_OUT = "checked_out"
    EXPIRED = "expired"


# ---------------------------------------------------------------------------
# CartItem
# ---------------------------------------------------------------------------
@dataclass(slots=True)
class CartItem:
    product_id: str
    name: str
    unit_price: Money
    quantity: int
    category: str = "general"
    added_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.quantity <= 0:
            raise ValueError("quantity debe ser > 0")
        if not self.product_id:
            raise ValueError("product_id vacío")

    @property
    def subtotal(self) -> Money:
        return self.unit_price * self.quantity

    def to_dict(self) -> Dict[str, Any]:
        return {
            "product_id": self.product_id,
            "name": self.name,
            "unit_price": self.unit_price.to_dict(),
            "quantity": self.quantity,
            "category": self.category,
            "added_at": self.added_at.isoformat(),
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> CartItem:
        return cls(
            product_id=data["product_id"],
            name=data["name"],
            unit_price=Money.from_dict(data["unit_price"]),
            quantity=data["quantity"],
            category=data.get("category", "general"),
            added_at=datetime.fromisoformat(data["added_at"]),
            metadata=data.get("metadata", {}),
        )


# ---------------------------------------------------------------------------
# Cart - Agregado raíz
# ---------------------------------------------------------------------------
@dataclass(slots=True)
class Cart:
    id: str
    user_id: Optional[str] = None
    items: Dict[str, CartItem] = field(default_factory=dict)  # key: product_id
    status: CartStatus = CartStatus.ACTIVE
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    version: int = 0  # optimistic locking
    coupon_code: Optional[str] = None
    currency: str = "EUR"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.id:
            raise ValueError("Cart.id vacío")
        # Si no hay expiración, por defecto 7 días
        if self.expires_at is None and self.status == CartStatus.ACTIVE:
            object.__setattr__(
                self, "expires_at",
                datetime.now(timezone.utc) + timedelta(days=7)
            )

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at

    @property
    def total_items(self) -> int:
        return sum(i.quantity for i in self.items.values())

    @property
    def total_unique_items(self) -> int:
        return len(self.items)

    @property
    def subtotal(self) -> Money:
        total = Decimal("0")
        for item in self.items.values():
            total += item.subtotal.amount
        return Money(total, self.currency)

    def is_empty(self) -> bool:
        return len(self.items) == 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "items": {k: v.to_dict() for k, v in self.items.items()},
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "version": self.version,
            "coupon_code": self.coupon_code,
            "currency": self.currency,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Cart:
        return cls(
            id=data["id"],
            user_id=data.get("user_id"),
            items={k: CartItem.from_dict(v) for k, v in data.get("items", {}).items()},
            status=CartStatus(data.get("status", "active")),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            expires_at=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None,
            version=data.get("version", 0),
            coupon_code=data.get("coupon_code"),
            currency=data.get("currency", "EUR"),
            metadata=data.get("metadata", {}),
        )

    @staticmethod
    def create(user_id: Optional[str] = None, currency: str = "EUR", ttl: Optional[timedelta] = None) -> Cart:
        now = datetime.now(timezone.utc)
        return Cart(
            id=str(uuid.uuid4()),
            user_id=user_id,
            created_at=now,
            updated_at=now,
            expires_at=now + (ttl or timedelta(days=7)),
            currency=currency,
        )
