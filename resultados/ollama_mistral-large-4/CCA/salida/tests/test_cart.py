"""Tests del dominio y de la aplicación del carrito (stdlib unittest)."""
from __future__ import annotations

import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cart import (  # noqa: E402
    Cart,
    CartLimitExceeded,
    CartNotFound,
    CartService,
    EmptyCart,
    EventBus,
    FixedDiscount,
    InMemoryCartRepository,
    InMemoryProductCatalog,
    InsufficientStock,
    ItemAdded,
    ItemNotInCart,
    Money,
    PercentageDiscount,
    PercentageTax,
    PricingEngine,
    Product,
    ProductNotFound,
    Quantity,
    SKU,
    SqliteCartRepository,
)


def make_catalog() -> InMemoryProductCatalog:
    return InMemoryProductCatalog(
        [
            Product(SKU("LIBRO-1"), "Libro de Python", Money.from_amount("19.99"), stock=10),
            Product(SKU("CAM-1"), "Camiseta", Money.from_amount("9.50"), stock=3),
            Product(SKU("USB-1"), "Memoria USB", Money.from_amount("5.00"), stock=None),
        ]
    )


def make_service(**kwargs) -> CartService:
    return CartService(
        repository=kwargs.pop("repository", InMemoryCartRepository()),
        catalog=kwargs.pop("catalog", make_catalog()),
        **kwargs,
    )


class TestMoney(unittest.TestCase):
    def test_suma_exacta_sin_error_de_coma_flotante(self):
        self.assertEqual(Money.from_amount("0.1") + Money.from_amount("0.2"), Money.from_amount("0.3"))

    def test_multiplicacion_por_cantidad(self):
        self.assertEqual(Money.from_amount("9.99") * 3, Money.from_amount("29.97"))

    def test_porcentaje(self):
        self.assertEqual(Money.from_amount("100.00").percentage(21), Money.from_amount("21.00"))
        self.assertEqual(Money.from_amount("19.99").percentage(10), Money.from_amount("2.00"))  # redondeo half-up

    def test_divisas_distintas_no_se_suman(self):
        with self.assertRaises(ValueError):
            Money.from_amount(10, "EUR") + Money.from_amount(10, "USD")


class TestValueObjects(unittest.TestCase):
    def test_sku_vacio_invalido(self):
        with self.assertRaises(ValueError):
            SKU("   ")

    def test_cantidad_invalida(self):
        for bad in (0, -1, 1.5):
            with self.assertRaises(ValueError):
                Quantity(bad)


class TestCartDomain(unittest.TestCase):
    def test_anadir_y_total(self):
        cart = Cart()
        libro = Product(SKU("L"), "Libro", Money.from_amount("10.00"))
        cart.add_item(libro, 2)
        self.assertEqual(cart.item_count, 2)
        self.assertEqual(cart.subtotal, Money.from_amount("20.00"))

    def test_anadir_acumula_cantidad(self):
        cart = Cart()
        p = Product(SKU("L"), "Libro", Money.from_amount("10.00"))
        cart.add_item(p, 1)
        cart.add_item(p, 2)
        self.assertEqual(cart.item_count, 3)
        self.assertEqual(cart.distinct_items, 1)

    def test_stock_insuficiente(self):
        cart = Cart()
        p = Product(SKU("L"), "Libro", Money.from_amount("10.00"), stock=2)
        cart.add_item(p, 2)
        with self.assertRaises(InsufficientStock):
            cart.add_item(p, 1)

    def test_limite_productos_distintos(self):
        cart = Cart(max_items=1)
        a = Product(SKU("A"), "A", Money.from_amount("1.00"))
        b = Product(SKU("B"), "B", Money.from_amount("1.00"))
        cart.add_item(a)
        with self.assertRaises(CartLimitExceeded):
            cart.add_item(b)

    def test_quitar_item_que_no_existe(self):
        cart = Cart()
        with self.assertRaises(ItemNotInCart):
            cart.remove_item("NOPE")

    def test_eventos_se_acumulan_y_drenan(self):
        cart = Cart()
        p = Product(SKU("L"), "Libro", Money.from_amount("10.00"))
        cart.add_item(p, 2)
        events = cart.drain_events()
        self.assertEqual(len(events), 1)
        self.assertIsInstance(events[0], ItemAdded)
        self.assertEqual(cart.drain_events(), [])

    def test_thread_safety_basico(self):
        cart = Cart()
        p = Product(SKU("L"), "Libro", Money.from_amount("1.00"))
        errors: list[Exception] = []

        def worker() -> None:
            try:
                for _ in range(100):
                    cart.add_item(p, 1)
            except Exception as exc:  # pragma: no cover
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(errors, [])
        self.assertEqual(cart.item_count, 800)


class TestCartService(unittest.TestCase):
    def test_flujo_completo(self):
        service = make_service(
            pricing_engine=PricingEngine(
                discounts=[PercentageDiscount(10)],
                taxes=[PercentageTax(21)],
            )
        )
        cart = service.create_cart()
        service.add_item(cart.id, "LIBRO-1", 2)   # 39.98
        service.add_item(cart.id, "CAM-1", 1)     #  9.50
        # subtotal 49.48, -10% = -4.95 => 44.53, +21% = 9.35 => 53.88
        receipt = service.get_receipt(cart.id)
        self.assertEqual(receipt.subtotal, Money.from_amount("49.48"))
        self.assertEqual(receipt.discount, Money.from_amount("4.95"))
        self.assertEqual(receipt.tax, Money.from_amount("9.35"))
        self.assertEqual(receipt.total, Money.from_amount("53.88"))
        # checkout: emite evento, vacía y persiste
        from cart import CartCheckedOut, DomainEvent

        events: list = []
        service.event_bus.subscribe(DomainEvent, events.append)
        checked = service.checkout(cart.id)
        self.assertTrue(any(isinstance(e, CartCheckedOut) for e in events))
        self.assertEqual(checked.total, receipt.total)
        self.assertTrue(service.get_cart(cart.id).is_empty)

    def test_eventos_publicados_tras_persistir(self):
        service = make_service()
        received: list = []
        service.event_bus.subscribe(ItemAdded, received.append)
        cart = service.create_cart()
        service.add_item(cart.id, "USB-1", 4)
        self.assertEqual(len(received), 1)
        event = received[0]
        self.assertEqual((event.cart_id, event.sku, event.quantity, event.new_quantity),
                         (cart.id, "USB-1", 4, 4))

    def test_producto_desconocido(self):
        service = make_service()
        cart = service.create_cart()
        with self.assertRaises(ProductNotFound):
            service.add_item(cart.id, "NO-EXISTE")

    def test_carrito_inexistente(self):
        service = make_service()
        with self.assertRaises(CartNotFound):
            service.get_cart("nope")

    def test_checkout_vacio(self):
        service = make_service()
        cart = service.create_cart()
        with self.assertRaises(EmptyCart):
            service.checkout(cart.id)

    def test_update_y_remove(self):
        service = make_service()
        cart = service.create_cart()
        service.add_item(cart.id, "CAM-1", 1)
        service.update_quantity(cart.id, "CAM-1", 3)
        self.assertEqual(service.get_cart(cart.id).item_count, 3)
        service.remove_item(cart.id, "CAM-1")
        self.assertTrue(service.get_cart(cart.id).is_empty)
        with self.assertRaises(ItemNotInCart):
            service.update_quantity(cart.id, "CAM-1", 1)

    def test_stock_limita_en_servicio(self):
        service = make_service()
        cart = service.create_cart()
        service.add_item(cart.id, "CAM-1", 3)
        with self.assertRaises(InsufficientStock):
            service.add_item(cart.id, "CAM-1", 1)

    def test_merge_carts(self):
        service = make_service()
        a = service.create_cart()
        b = service.create_cart()
        service.add_item(a.id, "LIBRO-1", 1)
        service.add_item(b.id, "USB-1", 2)
        merged = service.merge_carts(a.id, b.id)
        self.assertEqual(merged.distinct_items, 2)
        self.assertEqual(merged.item_count, 3)
        with self.assertRaises(CartNotFound):
            service.get_cart(a.id)  # el origen se eliminó

    def test_descuento_fijo_no_supera_subtotal(self):
        engine = PricingEngine(discounts=[FixedDiscount(Money.from_amount("100.00"))])
        service = make_service(pricing_engine=engine)
        cart = service.create_cart()
        service.add_item(cart.id, "USB-1", 1)  # 5.00
        receipt = service.get_receipt(cart.id)
        self.assertEqual(receipt.discount, Money.from_amount("5.00"))
        self.assertEqual(receipt.total, Money(0, "EUR"))

    def test_concurrencia_en_servicio(self):
        service = make_service()
        cart = service.create_cart()
        errors: list[Exception] = []

        def worker() -> None:
            try:
                for _ in range(20):
                    service.add_item(cart.id, "USB-1", 1)
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(errors, [])
        self.assertEqual(service.get_cart(cart.id).item_count, 100)


class TestSqliteRepository(unittest.TestCase):
    def test_persistencia_real(self):
        catalog = make_catalog()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "carts.db"
            # referencia estable por id en todas las conexiones
            repo1 = SqliteCartRepository(path, catalog.get)
            service = CartService(repo1, catalog)
            cart = service.create_cart()
            service.add_item(cart.id, "LIBRO-1", 2)
            repo1.close()

            # nueva "sesión": los datos siguen ahí
            repo2 = SqliteCartRepository(path, catalog.get)
            restored = repo2.get(cart.id)
            self.assertIsNotNone(restored)
            assert restored is not None
            self.assertEqual(restored.item_count, 2)
            self.assertEqual(restored.subtotal, Money.from_amount("39.98"))
            self.assertIn(cart.id, repo2.list_ids())
            repo2.delete(cart.id)
            self.assertIsNone(repo2.get(cart.id))
            repo2.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
