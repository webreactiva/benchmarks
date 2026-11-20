"""
Motor de precios extensible - Strategy Pattern.

Permite componer reglas:
  - Descuentos por volumen (bulk)
  - Cupones (porcentaje / fijo)
  - Impuestos por categoría/país
  - Envío por peso/total

Escalable: reglas son stateless y componibles. Se pueden cargar desde DB/config.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import List, Dict, Optional, Any

from .models import Cart, Money


class CouponType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"
    FREE_SHIPPING = "free_shipping"


@dataclass(slots=True)
class Coupon:
    code: str
    type: CouponType
    value: Decimal  # 10 => 10% ó 10 EUR según tipo
    min_purchase: Optional[Money] = None
    max_discount: Optional[Money] = None
    applicable_categories: Optional[List[str]] = None  # None = todas
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    uses: int = 0
    active: bool = True

    def is_valid(self, now: Optional[datetime] = None) -> bool:
        now = now or datetime.now(timezone.utc)
        if not self.active:
            return False
        if self.expires_at and now > self.expires_at:
            return False
        if self.max_uses is not None and self.uses >= self.max_uses:
            return False
        return True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "type": self.type.value,
            "value": str(self.value),
            "min_purchase": self.min_purchase.to_dict() if self.min_purchase else None,
            "max_discount": self.max_discount.to_dict() if self.max_discount else None,
            "applicable_categories": self.applicable_categories,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "max_uses": self.max_uses,
            "uses": self.uses,
            "active": self.active,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Coupon:
        return cls(
            code=data["code"],
            type=CouponType(data["type"]),
            value=Decimal(data["value"]),
            min_purchase=Money.from_dict(data["min_purchase"]) if data.get("min_purchase") else None,
            max_discount=Money.from_dict(data["max_discount"]) if data.get("max_discount") else None,
            applicable_categories=data.get("applicable_categories"),
            expires_at=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None,
            max_uses=data.get("max_uses"),
            uses=data.get("uses", 0),
            active=data.get("active", True),
        )


# ---------------------------------------------------------------------------
# Pricing Rules
# ---------------------------------------------------------------------------
class PricingRule(ABC):
    @abstractmethod
    def apply(self, cart: Cart, current_total: Money) -> Money:
        """Retorna descuento (Money positivo) a restar. 0 si no aplica."""
        ...

    @property
    def name(self) -> str:
        return self.__class__.__name__


@dataclass
class BulkDiscountRule(PricingRule):
    """Descuento si cantidad de un producto supera threshold. Ej: 10% si >=5 unidades."""
    product_id: str
    min_quantity: int
    discount_percent: Decimal  # 10 => 10%

    def apply(self, cart: Cart, current_total: Money) -> Money:
        item = cart.items.get(self.product_id)
        if not item or item.quantity < self.min_quantity:
            return Money(Decimal("0"), current_total.currency)
        discount = (item.subtotal.amount * self.discount_percent / Decimal("100")).quantize(Decimal("0.01"))
        return Money(discount, current_total.currency)


@dataclass
class CategoryDiscountRule(PricingRule):
    category: str
    discount_percent: Decimal

    def apply(self, cart: Cart, current_total: Money) -> Money:
        cat_total = sum(
            i.subtotal.amount for i in cart.items.values() if i.category == self.category
        )
        if cat_total == 0:
            return Money(Decimal("0"), current_total.currency)
        discount = (cat_total * self.discount_percent / Decimal("100")).quantize(Decimal("0.01"))
        return Money(discount, current_total.currency)


@dataclass
class CouponDiscountRule(PricingRule):
    coupons: Dict[str, Coupon]  # code -> Coupon

    def apply(self, cart: Cart, current_total: Money) -> Money:
        if not cart.coupon_code:
            return Money(Decimal("0"), current_total.currency)
        coupon = self.coupons.get(cart.coupon_code.upper())
        if not coupon or not coupon.is_valid():
            return Money(Decimal("0"), current_total.currency)

        # min_purchase check
        if coupon.min_purchase and cart.subtotal.amount < coupon.min_purchase.amount:
            return Money(Decimal("0"), current_total.currency)

        # Calcular base aplicable
        if coupon.applicable_categories:
            base = sum(
                i.subtotal.amount
                for i in cart.items.values()
                if i.category in coupon.applicable_categories
            )
        else:
            base = cart.subtotal.amount

        if base == 0:
            return Money(Decimal("0"), current_total.currency)

        if coupon.type == CouponType.PERCENTAGE:
            discount = (base * coupon.value / Decimal("100")).quantize(Decimal("0.01"))
        elif coupon.type == CouponType.FIXED:
            discount = min(coupon.value, base)
        elif coupon.type == CouponType.FREE_SHIPPING:
            return Money(Decimal("0"), current_total.currency)  # manejado en shipping
        else:
            discount = Decimal("0")

        if coupon.max_discount:
            discount = min(discount, coupon.max_discount.amount)

        return Money(discount, current_total.currency)


# ---------------------------------------------------------------------------
# Tax & Shipping
# ---------------------------------------------------------------------------
@dataclass
class TaxCalculator:
    """IVA por categoría o global."""
    default_rate: Decimal = Decimal("0.21")  # 21% España
    category_rates: Dict[str, Decimal] = field(default_factory=dict)

    def calculate(self, cart: Cart, after_discount_total: Money) -> Money:
        # Simplificado: si hay categorías con tasa distinta, calcular proporcional
        if not self.category_rates:
            tax = (after_discount_total.amount * self.default_rate).quantize(Decimal("0.01"))
            return Money(tax, after_discount_total.currency)

        # proporcional por categoría
        subtotal = cart.subtotal.amount
        if subtotal == 0:
            return Money(Decimal("0"), after_discount_total.currency)

        # distribuir descuento proporcionalmente
        discount_ratio = Decimal("0")
        if subtotal != 0:
            discount_amount = subtotal - after_discount_total.amount
            discount_ratio = discount_amount / subtotal if subtotal else Decimal("0")

        total_tax = Decimal("0")
        for item in cart.items.values():
            rate = self.category_rates.get(item.category, self.default_rate)
            # precio tras descuento proporcional
            item_after = item.subtotal.amount * (Decimal("1") - discount_ratio)
            total_tax += item_after * rate

        return Money(total_tax.quantize(Decimal("0.01")), after_discount_total.currency)


@dataclass
class ShippingCalculator:
    free_shipping_threshold: Optional[Money] = None
    flat_rate: Money = field(default_factory=lambda: Money(Decimal("4.99"), "EUR"))
    free_shipping_coupons: Optional[set] = None  # set de códigos

    def calculate(self, cart: Cart, after_discount_total: Money) -> Money:
        if cart.is_empty():
            return Money(Decimal("0"), after_discount_total.currency)

        # cupón free shipping
        if cart.coupon_code and self.free_shipping_coupons and cart.coupon_code.upper() in self.free_shipping_coupons:
            return Money(Decimal("0"), after_discount_total.currency)

        if self.free_shipping_threshold and after_discount_total.amount >= self.free_shipping_threshold.amount:
            return Money(Decimal("0"), after_discount_total.currency)

        return self.flat_rate


# ---------------------------------------------------------------------------
# PricingEngine - Orquestador
# ---------------------------------------------------------------------------
@dataclass
class PriceBreakdown:
    subtotal: Money
    discounts: Dict[str, Money]  # rule_name -> amount
    total_discount: Money
    after_discount: Money
    tax: Money
    shipping: Money
    total: Money

    def to_dict(self) -> Dict[str, Any]:
        return {
            "subtotal": self.subtotal.to_dict(),
            "discounts": {k: v.to_dict() for k, v in self.discounts.items()},
            "total_discount": self.total_discount.to_dict(),
            "after_discount": self.after_discount.to_dict(),
            "tax": self.tax.to_dict(),
            "shipping": self.shipping.to_dict(),
            "total": self.total.to_dict(),
        }


class PricingEngine:
    def __init__(
        self,
        rules: Optional[List[PricingRule]] = None,
        tax_calculator: Optional[TaxCalculator] = None,
        shipping_calculator: Optional[ShippingCalculator] = None,
    ):
        self.rules = rules or []
        self.tax_calculator = tax_calculator or TaxCalculator()
        self.shipping_calculator = shipping_calculator or ShippingCalculator()

    def add_rule(self, rule: PricingRule) -> None:
        self.rules.append(rule)

    def calculate(self, cart: Cart) -> PriceBreakdown:
        subtotal = cart.subtotal
        discounts: Dict[str, Money] = {}
        total_discount = Money(Decimal("0"), cart.currency)

        # Aplicar reglas secuencialmente sobre total decreciente si hace falta
        # Aquí cada regla calcula sobre subtotal original para simplicidad, pero soporta current_total
        current = subtotal
        for rule in self.rules:
            d = rule.apply(cart, current)
            if d.amount > 0:
                # cap: no exceder subtotal
                if d.amount > current.amount:
                    d = Money(current.amount, current.currency)
                discounts[rule.name + (f"({getattr(rule, 'product_id', '')})" if hasattr(rule, 'product_id') else "")] = d
                total_discount = Money(total_discount.amount + d.amount, cart.currency)
                current = Money(current.amount - d.amount, current.currency)

        after_discount = Money(subtotal.amount - total_discount.amount, cart.currency)
        # Evitar negativo
        if after_discount.amount < 0:
            after_discount = Money(Decimal("0"), cart.currency)

        tax = self.tax_calculator.calculate(cart, after_discount)
        shipping = self.shipping_calculator.calculate(cart, after_discount)

        total = Money(after_discount.amount + tax.amount + shipping.amount, cart.currency)

        return PriceBreakdown(
            subtotal=subtotal,
            discounts=discounts,
            total_discount=total_discount,
            after_discount=after_discount,
            tax=tax,
            shipping=shipping,
            total=total,
        )
