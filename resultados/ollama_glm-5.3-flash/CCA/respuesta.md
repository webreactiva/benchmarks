Voy a crear un carrito de la compra escalable en Python: arquitectura hexagonal (dominio, aplicación, infraestructura), API HTTP stateless, repositorios intercambiables (memoria/Redis), concurrencia segura y tests.

---

Infraestructura en memoria (thread-safe) y adaptador Redis:

---

Ahora la API HTTP stateless con `ThreadingHTTPServer` y el entrypoint:

---

Ahora los tests:

---

Corrijo `test_memory.py` con tests de concurrencia más significativos:

---

Fallas menores por orden de validación, `__eq__` falta en `Product` y precios como `int` en tests. Corrijo:

---

Ahora corrijo los tests:

---

24/24 tests pasan. Añado `pyproject.toml`, README y `.gitignore`, y hago un smoke test del servidor:

---

Listo. Carrito escalable en `CCA/`, con 24/24 tests pasando y servidor verificado con curl.

**Qué incluye:**
- **`cart/domain/`** — modelos puros (`Product`, `CartItem`, `Cart`), reglas de negocio, límites y `Decimal` para dinero
- **`cart/application/`** — `CartService` (casos de uso) y puertos (`CartRepository`, `ProductRepository`, `EventPublisher`)
- **`cart/infrastructure/`** — repositorios en memoria thread-safe (lock por carrito) y adaptador **Redis** con locking optimista (`WATCH`) para escalar a múltiples instancias
- **`cart/api/http.py`** — API REST sin estado (`POST /carts`, `POST /carts/{id}/items`, `PATCH/DELETE` líneas, `POST .../checkout`), ThreadingHTTPServer
- **`tests/`** — dominio, servicio, concurrencia (500 escrituras serializadas, checkout con 8 hilos donde solo uno gana) y API
- **`README.md` / `pyproject.toml`** — cómo correr (`python -m cart --port 8000`), endpoints y notas de escalado

**Escala porque:** API stateless detrás de balanceador + repositorio intercambiable (memoria→Redis), eventos de dominio para consumidores asíncronos, versión optimista por carrito y errores con códigos HTTP/JSON consistentes.
