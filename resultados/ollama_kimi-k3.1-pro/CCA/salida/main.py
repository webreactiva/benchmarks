"""Ejemplo reproducible del carrito de la compra."""

from models.carrito import Carrito
from models.producto import Producto
from service.producto_service import ProductoService


def mostrar_carrito(carrito: Carrito) -> None:
    for item in carrito.obtener_items():
        print(
            f"- {item.producto.nombre}: {item.cantidad} x "
            f"{item.producto.precio:.2f} {item.producto.moneda} = "
            f"{item.subtotal:.2f} {item.producto.moneda}"
        )
    moneda = carrito.moneda or "EUR"
    print(f"Total: {carrito.calcular_total():.2f} {moneda}")


def main() -> None:
    catalogo = ProductoService(
        [
            Producto("teclado", "Teclado mecánico", "79.90", stock=5),
            Producto("raton", "Ratón inalámbrico", "25.50", stock=8),
            Producto("alfombrilla", "Alfombrilla XL", "15.00", stock=10),
        ]
    )
    carrito = Carrito(catalogo)

    carrito.agregar_producto("teclado")
    carrito.agregar_producto("raton")
    carrito.agregar_producto("raton")
    carrito.agregar_producto("alfombrilla", 2)
    carrito.actualizar_cantidad("teclado", 2)
    carrito.quitar_producto("alfombrilla")

    mostrar_carrito(carrito)


if __name__ == "__main__":
    main()
