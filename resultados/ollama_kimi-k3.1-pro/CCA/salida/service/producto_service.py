"""Catálogo de productos en memoria, sustituible por otra implementación."""

from collections.abc import Iterable
from dataclasses import replace

from models.producto import Producto


class ProductoNoEncontradoError(LookupError):
    """El identificador solicitado no existe en el catálogo."""


class ProductoService:
    """Administra productos sin exponer su almacenamiento interno."""

    def __init__(self, productos: Iterable[Producto] | None = None) -> None:
        self._productos: dict[str, Producto] = {}
        for producto in productos or ():
            self.agregar_producto(producto)

    def agregar_producto(self, producto: Producto) -> None:
        if not isinstance(producto, Producto):
            raise TypeError("Solo se pueden registrar productos válidos.")
        if producto.id in self._productos:
            raise ValueError(f"Ya existe un producto con id '{producto.id}'.")
        self._productos[producto.id] = producto

    def obtener_producto(self, producto_id: str) -> Producto:
        producto_id = self._normalizar_id(producto_id)
        try:
            return self._productos[producto_id]
        except KeyError as exc:
            raise ProductoNoEncontradoError(
                f"No existe el producto '{producto_id}'."
            ) from exc

    def listar_productos(self) -> tuple[Producto, ...]:
        return tuple(self._productos.values())

    def actualizar_stock(self, producto_id: str, stock: int) -> Producto:
        producto = self.obtener_producto(producto_id)
        producto_actualizado = replace(producto, stock=stock)
        self._productos[producto.id] = producto_actualizado
        return producto_actualizado

    @staticmethod
    def _normalizar_id(producto_id: str) -> str:
        if not isinstance(producto_id, str) or not producto_id.strip():
            raise ValueError("El identificador del producto es obligatorio.")
        return producto_id.strip()
