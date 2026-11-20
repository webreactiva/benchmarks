Decido: Node.js + TypeScript + Fastify, arquitectura por capas (dominio / aplicación / infraestructura / HTTP), tests con Vitest.

---

Scaffolding listo. Ahora el dominio.

---

Dominio listo. Ahora la capa de aplicación (puertos + servicio):

---

Ahora la infraestructura:

---

Ahora los tests:

---

Typecheck y 21 tests OK. Smoke test del servidor:

---

Hecho. Carrito escalable en Node.js + TypeScript + Fastify en `/var/tmp/bench/ws-oY65Vggd` — typecheck limpio, 21 tests en verde, smoke test del flujo completo (crear → añadir → cupón → checkout) verificado.

**Estructura (capas + puertos):**
- `src/domain/` — Cart, motor de precios (céntimos enteros, cupones %/fijos con cap y subtotal mínimo, IVA, envío gratis por umbral), errores y eventos de dominio, sin dependencias
- `src/application/` — `CartService` con concurrencia optimista (`expectedVersion` → 409) y puertos (`CartRepository`, `ProductCatalog`, `CouponRepository`, `EventBus`)
- `src/infrastructure/` — implementaciones in-memory sustituibles por Redis/Postgres
- `src/http/` — API REST `/api/v1` (carts, items, coupon, checkout) con validación Zod y mapeo error→HTTP

**Claves de escalabilidad:** API stateless, compare-and-set por versión de carrito en vez de locks, eventos post-commit para outbox/mensajería, TTL de carrito, dinero en céntimos.

Pendiente si quisieras: persistencia Redis real y tests de carga. Ver `README.md` para arquitectura y despliegue.
