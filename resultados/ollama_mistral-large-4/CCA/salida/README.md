# Carrito de la compra escalable

Implementación en **Python 3.12+ sin dependencias externas** (solo stdlib), con
arquitectura hexagonal (puertos y adaptadores), para que cada pieza pueda crecer
o sustituirse de forma independiente.

```
cart/
├── domain/            # lógica de negocio pura, sin dependencias externas
│   ├── value_objects.py   # Money (céntimos, sin coma flotante), SKU, Quantity
│   ├── entities.py        # Product, CartItem, Cart (thread-safe, con eventos)
│   ├── events.py          # eventos de dominio + EventBus seguro entre hilos
│   └── exceptions.py      # errores de dominio con significado de negocio
├── application/       # casos de uso
│   ├── ports.py           # protocolos CartRepository y ProductCatalog
│   ├── pricing.py         # PricingEngine + estrategias de descuento/impuesto
│   └── services.py        # CartService: añadir, quitar, checkout, merge…
└── infrastructure/    # adaptadores concretos
    └── repositories.py    # catálogo y repositorio en memoria o SQLite
tests/test_cart.py     # tests con unittest (stdlib)
demo_cli.py            # demo ejecutable
```

## Uso rápido

```python
from cart import (CartService, InMemoryCartRepository, InMemoryProductCatalog,
                  Product, SKU, Money, PricingEngine, PercentageDiscount, PercentageTax)

catalog = InMemoryProductCatalog([
    Product(SKU("LIBRO-1"), "Libro de Python", Money.from_amount("19.99"), stock=10),
])
service = CartService(
    repository=InMemoryCartRepository(),
    catalog=catalog,
    pricing_engine=PricingEngine(
        discounts=[PercentageDiscount(10)],   # -10%
        taxes=[PercentageTax(21)],            # IVA 21%
    ),
)

cart = service.create_cart()
service.add_item(cart.id, "LIBRO-1", 2)
print(service.get_receipt(cart.id))   # vista previa con descuento e IVA
receipt = service.checkout(cart.id)   # cierra la compra, vacía el carrito
```

## Cómo escalar cada parte

| Necesidad | Qué tocar |
|---|---|
| Nueva promoción o impuesto | Añadir una clase con los protocolos `DiscountStrategy`/`TaxStrategy` de `cart/application/pricing.py` y enchufarla al `PricingEngine`. El carrito no cambia. |
| Nueva persistencia (Redis, PostgreSQL, API) | Implementar los protocolos de `cart/application/ports.py` (`CartRepository`, `ProductCatalog`). El servicio no cambia. |
| Reaccionar a acciones del carrito (emails, métricas, pedidos) | Suscribir handlers al `EventBus` (`ItemAdded`, `CartCheckedOut`, …). Los handlers fallan de forma aislada. |
| Reglas nuevas de negocio | Ampliar `Cart` en `cart/domain` (límites, stock, monedas) sin tocar infraestructura. |

## Garantías

- **Dinero exacto**: `Money` guarda céntimos enteros (`0.1 + 0.2 == 0.3`), redondeo half-up en porcentajes.
- **Thread-safe**: el carrito y los repositorios usan locks internos; probado con tests de concurrencia.
- **Eventos tras persistir**: `CartService._save` guarda primero y publica después, así un handler nunca ve un estado no persistido.
- **Límites de negocio**: stock por producto, máximo de unidades por línea y máximo de SKUs distintos por carrito.

## Ejecutar

```bash
python3 -m unittest discover -s tests -v   # tests
python3 demo_cli.py                          # demo en memoria
python3 demo_cli.py /tmp/carts.db            # demo con persistencia SQLite
```
