"""Lógica del carrito, independiente del almacenamiento del catálogo."""

from decimal import Decimal
from typing import Protocol

from models.item_carrito import ItemCarrito, validar_cantidad
from models.producto import Producto, redondear_monetario


class CatalogoProductos(Protocol):
    """Contrato mínimo que debe cumplir cualquier catálogo inyectable."""

    def obtener_producto(self, producto_id: str) -> Producto:
        """Devuelve un producto o lanza un error si no está disponible."""
        ...


class Carrito:
    """Carrito con una única entrada por producto y validación atómica."""

    def __init__(self, catalogo: CatalogoProductos) -> None:
        if catalogo is None:
            raise ValueError("El carrito necesita un catálogo de productos.")
        self._catalogo = catalogo
        self._items: dict[str, ItemCarrito] = {}

    def agregar_producto(self, producto_id: str, cantidad: int = 1) -> ItemCarrito:
        """Añade un producto o incrementa la cantidad de su entrada actual."""
        validar_cantidad(cantidad)
        producto = self._obtener_producto(producto_id)
        self._validar_moneda(producto)

        item_actual = self._items.get(producto.id)
        cantidad_actual = item_actual.cantidad if item_actual else 0
        nuevo_item = ItemCarrito(producto, cantidad_actual + cantidad)
        self._items[producto.id] = nuevo_item
        return nuevo_item

    def actualizar_cantidad(self, producto_id: str, cantidad: int) -> ItemCarrito:
        """Sustituye la cantidad de un producto que ya está en el carrito."""
        validar_cantidad(cantidad)
        producto_id = self._normalizar_id(producto_id)
        if producto_id not in self._items:
            raise KeyError(f"El producto '{producto_id}' no está en el carrito.")

        producto = self._obtener_producto(producto_id)
        self._validar_moneda(producto)
        nuevo_item = ItemCarrito(producto, cantidad)
        self._items[producto.id] = nuevo_item
        return nuevo_item

    def quitar_producto(self, producto_id: str) -> bool:
        """Quita una entrada e indica si existía; repetir la operación es seguro."""
        producto_id = self._normalizar_id(producto_id)
        return self._items.pop(producto_id, None) is not None

    def vaciar(self) -> None:
        self._items.clear()

    def obtener_items(self) -> tuple[ItemCarrito, ...]:
        """Devuelve una instantánea inmutable en orden de inserción."""
        return tuple(self._items.values())

    def calcular_total(self) -> Decimal:
        total = sum(
            (item.subtotal for item in self._items.values()),
            start=Decimal("0.00"),
        )
        return redondear_monetario(total)

    @property
    def cantidad_total(self) -> int:
        return sum(item.cantidad for item in self._items.values())

    @property
    def moneda(self) -> str | None:
        if not self._items:
            return None
        return next(iter(self._items.values())).producto.moneda

    def _obtener_producto(self, producto_id: str) -> Producto:
        return self._catalogo.obtener_producto(self._normalizar_id(producto_id))

    def _validar_moneda(self, producto: Producto) -> None:
        if self.moneda is not None and producto.moneda != self.moneda:
            raise ValueError(
                "No se pueden mezclar monedas en el mismo carrito: "
                f"{self.moneda} y {producto.moneda}."
            )

    @staticmethod
    def _normalizar_id(producto_id: str) -> str:
        if not isinstance(producto_id, str) or not producto_id.strip():
            raise ValueError("El identificador del producto es obligatorio.")
        return producto_id.strip()
