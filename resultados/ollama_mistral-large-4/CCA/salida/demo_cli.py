#!/usr/bin/env python3
"""CLI de demostración del carrito de la compra.

Uso:
    python3 demo_cli.py            # demo guiada con datos de ejemplo
    python3 demo_cli.py <db_path>  # igual, pero persiste en SQLite
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cart import (  # noqa: E402
    CartService,
    DomainEvent,
    InMemoryCartRepository,
    InMemoryProductCatalog,
    Money,
    PercentageDiscount,
    PercentageTax,
    PricingEngine,
    Product,
    SKU,
    SqliteCartRepository,
)


def build_service(db_path: str | None = None) -> CartService:
    catalog = InMemoryProductCatalog(
        [
            Product(SKU("LIBRO-PY"), "Python a fondo", Money.from_amount("29.99"), stock=20),
            Product(SKU("CAM-ORG"), "Camiseta orgánica", Money.from_amount("14.95"), stock=8),
            Product(SKU("TAZA-LOG"), "Taza con logo", Money.from_amount("7.50")),
            Product(SKU("USB-64"), "USB 64 GB", Money.from_amount("11.20")),
        ]
    )
    repository = (
        SqliteCartRepository(db_path, catalog.get) if db_path else InMemoryCartRepository()
    )
    engine = PricingEngine(
        discounts=[PercentageDiscount(10, name="-10% campaña")],
        taxes=[PercentageTax(21, name="IVA 21%")],
    )
    service = CartService(repository, catalog, pricing_engine=engine)
    service.event_bus.subscribe(
        DomainEvent, lambda e: print(f"    [evento] {type(e).__name__}")
    )
    return service


def main() -> None:
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    service = build_service(db_path)

    print("== Crear carrito y añadir productos ==")
    cart = service.create_cart()
    print(f"Carrito {cart.id}")
    service.add_item(cart.id, "LIBRO-PY", 1)
    service.add_item(cart.id, "CAM-ORG", 2)
    service.add_item(cart.id, "TAZA-LOG", 1)
    service.add_item(cart.id, "LIBRO-PY", 1)  # acumula: 2 libros

    print("\n== Recibo previo (con descuento del 10% e IVA 21%) ==")
    print(service.get_receipt(cart.id))

    print("\n== Actualizar cantidad ==")
    service.update_quantity(cart.id, "TAZA-LOG", 3)
    receipt = service.get_receipt(cart.id)
    print(receipt)

    print("\n== Checkout ==")
    final = service.checkout(cart.id)
    print(final)
    print(f"Carrito tras checkout: vacío = {service.get_cart(cart.id).is_empty}")

    if db_path:
        print(f"\n(Datos persistidos en {db_path})")


if __name__ == "__main__":
    main()
