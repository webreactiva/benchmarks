"""Pruebas del flujo de compra y de las reglas del dominio."""

from decimal import Decimal
import unittest

from models.carrito import Carrito
from models.item_carrito import ItemCarrito
from models.producto import Producto
from service.producto_service import ProductoNoEncontradoError, ProductoService


class CarritoTest(unittest.TestCase):
    def setUp(self) -> None:
        self.catalogo = ProductoService(
            [
                Producto("teclado", "Teclado", "10.50", stock=5),
                Producto("raton", "Ratón", "3.25", stock=10),
                Producto("monitor", "Monitor", "100.00", "USD", 2),
            ]
        )
        self.carrito = Carrito(self.catalogo)

    def test_flujo_completo(self) -> None:
        self.carrito.agregar_producto("teclado", 2)
        self.carrito.agregar_producto("raton")
        item_repetido = self.carrito.agregar_producto("teclado")

        self.assertEqual(3, item_repetido.cantidad)
        self.assertEqual(2, len(self.carrito.obtener_items()))
        self.assertEqual(4, self.carrito.cantidad_total)
        self.assertEqual(Decimal("34.75"), self.carrito.calcular_total())

        self.carrito.actualizar_cantidad("raton", 3)
        self.assertEqual(Decimal("41.25"), self.carrito.calcular_total())

        self.assertTrue(self.carrito.quitar_producto("teclado"))
        self.assertFalse(self.carrito.quitar_producto("teclado"))
        self.assertEqual(Decimal("9.75"), self.carrito.calcular_total())

        self.carrito.vaciar()
        self.assertEqual((), self.carrito.obtener_items())
        self.assertEqual(Decimal("0.00"), self.carrito.calcular_total())
        self.assertIsNone(self.carrito.moneda)

    def test_producto_desconocido_no_altera_el_carrito(self) -> None:
        with self.assertRaises(ProductoNoEncontradoError):
            self.carrito.agregar_producto("inexistente")

        self.assertEqual((), self.carrito.obtener_items())
        self.assertEqual(Decimal("0.00"), self.carrito.calcular_total())

    def test_no_permite_superar_el_stock_al_acumular(self) -> None:
        self.carrito.agregar_producto("teclado", 4)

        with self.assertRaisesRegex(ValueError, "Stock insuficiente"):
            self.carrito.agregar_producto("teclado", 2)

        self.assertEqual(4, self.carrito.obtener_items()[0].cantidad)

    def test_no_permite_superar_el_stock_al_actualizar(self) -> None:
        self.carrito.agregar_producto("teclado", 2)
        self.catalogo.actualizar_stock("teclado", 1)

        with self.assertRaisesRegex(ValueError, "Stock insuficiente"):
            self.carrito.actualizar_cantidad("teclado", 2)

        self.assertEqual(2, self.carrito.obtener_items()[0].cantidad)

    def test_rechaza_cantidades_invalidas(self) -> None:
        self.carrito.agregar_producto("teclado")
        for cantidad in (0, -1, 1.5, "2", True, None):
            with self.subTest(operacion="agregar", cantidad=cantidad):
                with self.assertRaises(ValueError):
                    self.carrito.agregar_producto("teclado", cantidad)
            with self.subTest(operacion="actualizar", cantidad=cantidad):
                with self.assertRaises(ValueError):
                    self.carrito.actualizar_cantidad("teclado", cantidad)

        self.assertEqual(1, self.carrito.obtener_items()[0].cantidad)

    def test_actualizar_exige_que_el_producto_este_en_el_carrito(self) -> None:
        with self.assertRaises(KeyError):
            self.carrito.actualizar_cantidad("teclado", 2)

    def test_no_mezcla_monedas(self) -> None:
        self.carrito.agregar_producto("teclado")

        with self.assertRaisesRegex(ValueError, "mezclar monedas"):
            self.carrito.agregar_producto("monitor")

        self.assertEqual(1, len(self.carrito.obtener_items()))
        self.assertEqual("EUR", self.carrito.moneda)

    def test_permite_cambiar_de_moneda_despues_de_vaciar(self) -> None:
        self.carrito.agregar_producto("teclado")
        self.carrito.vaciar()
        self.carrito.agregar_producto("monitor")

        self.assertEqual("USD", self.carrito.moneda)
        self.assertEqual(Decimal("100.00"), self.carrito.calcular_total())

    def test_redondeo_monetario_uniforme(self) -> None:
        catalogo = ProductoService(
            [Producto("medicion", "Medición", "0.105", stock=3)]
        )
        carrito = Carrito(catalogo)
        carrito.agregar_producto("medicion", 3)

        self.assertEqual(Decimal("0.11"), catalogo.obtener_producto("medicion").precio)
        self.assertEqual(Decimal("0.33"), carrito.calcular_total())

    def test_los_items_devueltos_son_una_instantanea_inmutable(self) -> None:
        self.carrito.agregar_producto("teclado")
        items = self.carrito.obtener_items()
        self.carrito.agregar_producto("teclado")

        self.assertIsInstance(items, tuple)
        self.assertEqual(1, items[0].cantidad)
        self.assertEqual(2, self.carrito.obtener_items()[0].cantidad)
        with self.assertRaises(TypeError):
            items[0] = items[0]

    def test_item_valida_stock_y_cantidad(self) -> None:
        producto = self.catalogo.obtener_producto("teclado")
        with self.assertRaises(ValueError):
            ItemCarrito(producto, 0)
        with self.assertRaises(ValueError):
            ItemCarrito(producto, 6)


class ProductoTest(unittest.TestCase):
    def test_acepta_precio_y_stock_cero(self) -> None:
        producto = Producto("muestra", "Muestra", 0, stock=0)
        self.assertEqual(Decimal("0.00"), producto.precio)
        self.assertEqual(0, producto.stock)

    def test_rechaza_precios_invalidos(self) -> None:
        for precio in (-1, "-0.01", "NaN", "Infinity", "no-es-numero", True, None):
            with self.subTest(precio=precio):
                with self.assertRaises(ValueError):
                    Producto("p1", "Producto", precio, stock=1)

    def test_rechaza_stock_invalido(self) -> None:
        for stock in (-1, 1.5, "1", True, None):
            with self.subTest(stock=stock):
                with self.assertRaises(ValueError):
                    Producto("p1", "Producto", 1, stock=stock)

    def test_normaliza_y_valida_sus_datos(self) -> None:
        producto = Producto(" p1 ", " Producto ", "1", "eur", 1)
        self.assertEqual("p1", producto.id)
        self.assertEqual("Producto", producto.nombre)
        self.assertEqual("EUR", producto.moneda)

        for moneda in ("", "EU", "EURO", "E1R"):
            with self.subTest(moneda=moneda):
                with self.assertRaises(ValueError):
                    Producto("p2", "Producto", 1, moneda, 1)


class ProductoServiceTest(unittest.TestCase):
    def test_gestiona_productos_y_stock(self) -> None:
        producto = Producto("p1", "Producto", "2.00", stock=2)
        servicio = ProductoService([producto])

        self.assertEqual((producto,), servicio.listar_productos())
        self.assertEqual(5, servicio.actualizar_stock("p1", 5).stock)
        with self.assertRaises(ValueError):
            servicio.actualizar_stock("p1", -1)
        self.assertEqual(5, servicio.obtener_producto("p1").stock)

    def test_rechaza_duplicados_y_busquedas_vacias(self) -> None:
        producto = Producto("p1", "Producto", 1, stock=1)
        servicio = ProductoService([producto])

        with self.assertRaises(ValueError):
            servicio.agregar_producto(producto)
        with self.assertRaises(ValueError):
            servicio.obtener_producto(" ")
        with self.assertRaises(ProductoNoEncontradoError):
            servicio.obtener_producto("otro")


if __name__ == "__main__":
    unittest.main()
