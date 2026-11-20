"""Modelo de producto y reglas de validación monetaria."""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re


PRECISION_MONETARIA = Decimal("0.01")


def redondear_monetario(importe: Decimal) -> Decimal:
    """Redondea un importe a céntimos con un criterio uniforme."""
    return importe.quantize(PRECISION_MONETARIA, rounding=ROUND_HALF_UP)


def _convertir_precio(precio: Decimal | int | float | str) -> Decimal:
    if isinstance(precio, bool):
        raise ValueError("El precio debe ser numérico.")

    try:
        importe = precio if isinstance(precio, Decimal) else Decimal(str(precio))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("El precio debe ser numérico.") from exc

    if not importe.is_finite():
        raise ValueError("El precio debe ser finito.")
    if importe < 0:
        raise ValueError("El precio no puede ser negativo.")

    try:
        return redondear_monetario(importe)
    except InvalidOperation as exc:
        raise ValueError("El precio está fuera del rango admitido.") from exc


@dataclass(frozen=True, slots=True)
class Producto:
    """Producto inmutable del catálogo."""

    id: str
    nombre: str
    precio: Decimal | int | float | str
    moneda: str = "EUR"
    stock: int = 0

    def __post_init__(self) -> None:
        if not isinstance(self.id, str) or not self.id.strip():
            raise ValueError("El identificador del producto es obligatorio.")
        if not isinstance(self.nombre, str) or not self.nombre.strip():
            raise ValueError("El nombre del producto es obligatorio.")
        if not isinstance(self.stock, int) or isinstance(self.stock, bool):
            raise ValueError("El stock debe ser un número entero.")
        if self.stock < 0:
            raise ValueError("El stock no puede ser negativo.")
        if not isinstance(self.moneda, str) or not re.fullmatch(
            r"[A-Za-z]{3}", self.moneda
        ):
            raise ValueError("La moneda debe tener un código de tres letras.")

        object.__setattr__(self, "id", self.id.strip())
        object.__setattr__(self, "nombre", self.nombre.strip())
        object.__setattr__(self, "moneda", self.moneda.upper())
        object.__setattr__(self, "precio", _convertir_precio(self.precio))
