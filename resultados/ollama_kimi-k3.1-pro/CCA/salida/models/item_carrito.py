"""Elemento inmutable del carrito."""

from dataclasses import dataclass
from decimal import Decimal

from models.producto import Producto, redondear_monetario


def validar_cantidad(cantidad: int) -> None:
    """Exige cantidades enteras estrictamente positivas."""
    if not isinstance(cantidad, int) or isinstance(cantidad, bool):
        raise ValueError("La cantidad debe ser un número entero.")
    if cantidad <= 0:
        raise ValueError("La cantidad debe ser mayor que cero.")


@dataclass(frozen=True, slots=True)
class ItemCarrito:
    """Producto y cantidad seleccionada, con subtotal calculado."""

    producto: Producto
    cantidad: int

    def __post_init__(self) -> None:
        if not isinstance(self.producto, Producto):
            raise TypeError("El elemento debe contener un producto válido.")
        validar_cantidad(self.cantidad)
        if self.cantidad > self.producto.stock:
            raise ValueError(
                f"Stock insuficiente para '{self.producto.id}': "
                f"disponible {self.producto.stock}."
            )

    @property
    def subtotal(self) -> Decimal:
        return redondear_monetario(self.producto.precio * self.cantidad)
