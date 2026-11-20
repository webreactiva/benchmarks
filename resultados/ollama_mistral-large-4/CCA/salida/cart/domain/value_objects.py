"""Value objects inmutables del dominio.

Se comparan por valor, no por identidad, y encapsulan las reglas de
validación (dinero exacto en céntimos, SKU no vacío, cantidades >= 1).
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


@dataclass(frozen=True, order=True)
class Money:
    """Importe monetario exacto almacenado en céntimos.

    Evita por completo los errores de coma flotante: 0.1 + 0.2 == 0.3.
    """

    cents: int
    currency: str = "EUR"

    def __post_init__(self) -> None:
        if isinstance(self.cents, bool) or not isinstance(self.cents, int):
            raise TypeError("cents debe ser un entero")
        if len(self.currency) != 3 or not self.currency.isalpha():
            raise ValueError("currency debe ser un código ISO 4217 de 3 letras")

    @classmethod
    def from_amount(cls, amount: float | int | str | Decimal, currency: str = "EUR") -> "Money":
        """Crea un Money a partir de un importe decimal (ej. ``12.99``)."""
        cents = (Decimal(str(amount)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return cls(int(cents), currency)

    @property
    def amount(self) -> Decimal:
        """Importe como Decimal (solo para mostrar/serializar)."""
        return Decimal(self.cents) / 100

    def __add__(self, other: "Money") -> "Money":
        self._check_currency(other)
        return Money(self.cents + other.cents, self.currency)

    def __sub__(self, other: "Money") -> "Money":
        self._check_currency(other)
        return Money(self.cents - other.cents, self.currency)

    def __mul__(self, factor: int) -> "Money":
        if isinstance(factor, bool) or not isinstance(factor, int):
            raise TypeError("Money solo se puede multiplicar por un entero (cantidad)")
        return Money(self.cents * factor, self.currency)

    __rmul__ = __mul__

    def percentage(self, percent: Decimal | int | str) -> "Money":
        """Devuelve el ``percent``% de este importe, redondeado a céntimo (half-up)."""
        pct = Decimal(str(percent))
        cents = (Decimal(self.cents) * pct / Decimal(100)).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
        return Money(int(cents), self.currency)

    def _check_currency(self, other: "Money") -> None:
        if not isinstance(other, Money):
            raise TypeError("Solo se pueden operar objetos Money entre sí")
        if self.currency != other.currency:
            raise ValueError(f"Divisas distintas: {self.currency} vs {other.currency}")

    def __str__(self) -> str:
        sign = "-" if self.cents < 0 else ""
        return f"{sign}{self.amount:.2f} {self.currency}"


@dataclass(frozen=True)
class SKU:
    """Identificador de producto (stock keeping unit)."""

    value: str

    def __post_init__(self) -> None:
        if not self.value or not self.value.strip():
            raise ValueError("El SKU no puede estar vacío")
        object.__setattr__(self, "value", self.value.strip())

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class Quantity:
    """Cantidad de unidades de un producto (entero >= 1)."""

    value: int

    def __post_init__(self) -> None:
        if isinstance(self.value, bool) or not isinstance(self.value, int) or self.value < 1:
            raise ValueError("La cantidad debe ser un entero >= 1")

    def __int__(self) -> int:
        return self.value

    def __str__(self) -> str:
        return str(self.value)
