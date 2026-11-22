"""Motor de precios: descuentos e impuestos como estrategias intercambiables.

Añadir una nueva promoción o un nuevo impuesto no requiere tocar el carrito:
basta con implementar el protocolo y añadir la estrategia al motor.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol, Sequence

from ..domain.entities import Cart
from ..domain.value_objects import Money


@dataclass(frozen=True)
class ReceiptLine:
    sku: str
    name: str
    unit_price: Money
    quantity: int
    line_total: Money


@dataclass(frozen=True)
class Receipt:
    """Recibo/factura resultado de tasar un carrito."""

    cart_id: str
    lines: tuple[ReceiptLine, ...]
    subtotal: Money
    discount: Money
    tax: Money
    total: Money

    def __str__(self) -> str:
        out = [f"Recibo del carrito {self.cart_id}"]
        for line in self.lines:
            out.append(
                f"  {line.sku}  {line.name}  x{line.quantity} @ {line.unit_price}"
                f" = {line.line_total}"
            )
        out.append(f"  Subtotal : {self.subtotal}")
        if self.discount.cents:
            out.append(f"  Descuento: -{self.discount}")
        if self.tax.cents:
            out.append(f"  Impuestos: {self.tax}")
        out.append(f"  TOTAL    : {self.total}")
        return "\n".join(out)


class DiscountStrategy(Protocol):
    """Estrategia de descuento: devuelve el importe a descontar sobre ``amount``."""

    @property
    def name(self) -> str: ...

    def apply(self, amount: Money) -> Money: ...


class TaxStrategy(Protocol):
    """Estrategia de impuesto: devuelve el importe del impuesto sobre ``amount``."""

    @property
    def name(self) -> str: ...

    def apply(self, amount: Money) -> Money: ...


class PercentageDiscount:
    """Descuento porcentual (p. ej. 10%)."""

    def __init__(self, percent: Decimal | int | str, name: str | None = None) -> None:
        self.percent = Decimal(str(percent))
        if self.percent < 0:
            raise ValueError("El porcentaje de descuento no puede ser negativo")
        self._name = name or f"-{self.percent}%"

    @property
    def name(self) -> str:
        return self._name

    def apply(self, amount: Money) -> Money:
        return amount.percentage(self.percent)


class FixedDiscount:
    """Descuento de importe fijo; nunca descuenta más que el importe dado."""

    def __init__(self, amount: Money, name: str | None = None) -> None:
        self.amount = amount
        self._name = name or f"Cupón {amount}"

    @property
    def name(self) -> str:
        return self._name

    def apply(self, amount: Money) -> Money:
        if self.amount.currency != amount.currency:
            raise ValueError("Divisa del cupón distinta de la del carrito")
        return self.amount if self.amount < amount else amount


class PercentageTax:
    """Impuesto porcentual sobre la base imponible (p. ej. IVA 21%)."""

    def __init__(self, rate: Decimal | int | str, name: str | None = None) -> None:
        self.rate = Decimal(str(rate))
        if self.rate < 0:
            raise ValueError("El tipo de impuesto no puede ser negativo")
        self._name = name or f"Impuesto {self.rate}%"

    @property
    def name(self) -> str:
        return self._name

    def apply(self, amount: Money) -> Money:
        return amount.percentage(self.rate)


class PricingEngine:
    """Tasa un carrito aplicando descuentos (en cadena, sobre el resto) y
    luego impuestos sobre la base imponible resultante."""

    def __init__(
        self,
        discounts: Sequence[DiscountStrategy] = (),
        taxes: Sequence[TaxStrategy] = (),
    ) -> None:
        self.discounts = tuple(discounts)
        self.taxes = tuple(taxes)

    def price(self, cart: Cart) -> Receipt:
        lines = tuple(
            ReceiptLine(
                sku=item.sku.value,
                name=item.product.name,
                unit_price=item.product.price,
                quantity=item.quantity.value,
                line_total=item.line_total,
            )
            for item in cart.items
        )
        subtotal = cart.subtotal
        discount = Money(0, subtotal.currency)
        remaining = subtotal
        for strategy in self.discounts:
            disc = strategy.apply(remaining)
            discount = discount + disc
            remaining = remaining - disc
        tax = Money(0, subtotal.currency)
        for strategy in self.taxes:
            tax = tax + strategy.apply(remaining)
        total = subtotal - discount + tax
        return Receipt(
            cart_id=cart.id,
            lines=lines,
            subtotal=subtotal,
            discount=discount,
            tax=tax,
            total=total,
        )
