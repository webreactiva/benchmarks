Voy a implementar un carrito de la compra escalable en la carpeta actual. Primero, miro qué hay en el directorio y la versión de Python disponible.

---

La carpeta está vacía y tengo Python 3.13. Voy a implementar un carrito de la compra escalable con arquitectura hexagonal (dominio puro + puertos/adaptadores), estrategias de precios enchufables, eventos de dominio, dinero exacto en céntimos y persistencia intercambiable (memoria/SQLite). Creo toda la estructura de golpe:

---

Estructura creada. Ahora añado la batería de tests (stdlib `unittest`, sin dependencias externas), un CLI de demostración y un README:

---

Ahora corrijo un detalle en los tests y la demo (suscribirse al tipo base `DomainEvent` en lugar de `object`) y ejecuto todo:

---

Un nombre de método con espacios no es válido en Python; lo corrijo:

---

Los 24 tests pasan. Ahora pruebo la demo en memoria y con persistencia SQLite:

---

Todo funciona. Estructura final creada en `/var/tmp/bench/ws-YEm7YZf4`:

```
cart/
├── domain/
│   ├── value_objects.py    # Money (céntimos enteros, sin coma flotante), SKU, Quantity
│   ├── entities.py         # Product, CartItem, Cart (thread-safe, con eventos de dominio)
│   ├── events.py           # EventBus seguro entre hilos + 7 tipos de eventos
│   └── exceptions.py       # errores de dominio tipados
├── application/
│   ├── ports.py            # protocolos CartRepository y ProductCatalog
│   ├── pricing.py          # PricingEngine con estrategias enchufables (descuentos/impuestos)
│   └── services.py         # CartService: crear, añadir, actualizar, quitar, tasar, checkout, merge
└── infrastructure/
    └── repositories.py     # adaptadores: InMemory y SQLite (JSON por carrito)
tests/test_cart.py          # 24 tests (todos en verde)
demo_cli.py                 # demo ejecutable (memoria o SQLite)
README.md
```

**Puntos clave de escalabilidad:**

- **Arquitectura hexagonal**: el caso de uso (`CartService`) depende solo de protocolos (`ports.py`). Para cambiar a Redis/PostgreSQL/API basta implementar `CartRepository`/`ProductCatalog`; para añadir una promoción o un impuesto basta implementar `DiscountStrategy`/`TaxStrategy` y enchufarlo al `PricingEngine` — sin tocar el carrito.
- **Eventos de dominio**: `CartCreated`, `ItemAdded`, `CartCheckedOut`, etc. Se publican *después* de persistir vía `EventBus`, con handlers aislados (uno que falla no rompe la operación) — ideal para enchufar auditoría, emails o métricas.
- **Dinero exacto**: `Money` almacena céntimos (`0.1 + 0.2 == 0.3`), con redondeo half-up en porcentajes y contrôle de divisas.
- **Seguridad y reglas de negocio**: locks internos en carrito/repositorios (test de concurrencia con 8 hilos pasando), límites de stock, de unidades por línea y de SKUs distintos por carrito.

**Verificación**: `python3 -m unittest discover -s tests -v` → 24 tests OK; `python3 demo_cli.py` (y con ruta SQLite) ejecuta el flujo completo mostrando eventos, recibo con descuento del 10% + IVA 21% y checkout.
