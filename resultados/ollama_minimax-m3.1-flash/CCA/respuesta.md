Voy a construir un carrito de la compra escalable (API stateless + Redis con versionado optimista, idempotencia, eventos y rate limiting) en Node/TypeScript. Empiezo por el andamiaje.

---

Redis disponible para tests. Escribo el dominio y la configuración.

---

Ahora el núcleo: scripts Lua atómicos para Redis (mutación con versionado optimista + merge).

---

El `keyPrefix` de ioredis sí se aplica a scripts personalizados. Añado emisión transaccional de eventos (outbox) dentro de los scripts Lua.

---

Ahora la capa de aplicación con los casos de uso.

---

Ahora la capa HTTP: auth, rate limiting, métricas y rutas.

---

Ahora las pruebas. Primero las unitarias:

---

Encontré un bug real: ioredis no conoce la posición de la clave en `XGROUP`, así que el grupo se creaba sin prefijo. Extraigo el consumidor a un módulo testeable.

---

Listo. Carrito escalable implementado en `/var/tmp/bench/ws-bseDNO3D` (Node 22 + TypeScript + Fastify + Redis).

**Cómo escalarlo (decisiones clave)**
- **API stateless**: todo el estado del carrito vive en Redis → `docker compose up --scale api=8` sin afinidad de sesión.
- **Mutaciones atómicas en scripts Lua** (`src/infrastructure/lua/cart.lua`, `merge.lua`): sin *lost updates* entre réplicas.
- **Concurrencia optimista**: `If-Match: "<version>"` → `409 CART_VERSION_CONFLICT` en vez de sobrescribir.
- **Idempotencia**: cabecera `Idempotency-Key` con almacén Redis (reintentos sin duplicar efectos).
- **Outbox transaccional**: el evento se escribe en el *mismo* script Lua que la mutación; worker con grupo de consumidores + `XAUTOCLAIM`.
- **Rate limiting distribuido** (token bucket en Redis), **caché LRU local** para lecturas, **degradación elegante** si Redis cae, métricas Prometheus y `/healthz` `/readyz`.
- **Precios siempre en servidor** (el cliente nunca manda importes) y **dinero en céntimos enteros**.

**Verificación**: `npm run build`, `typecheck`, `lint` y **42 pruebas** en verde (incluye paridad Lua↔TS del motor de precios, 40 altas concurrentes → 40 unidades, conflicto de versión 200+409, replay idempotente, outbox y rate limiting).

**Dos bugs reales encontrados y corregidos durante el desarrollo**: `ioredis` no aplica `keyPrefix` a `XGROUP`/`XINFO` (el worker fallaba con `NOGROUP`) y el `commandTimeout` abortaba la lectura bloqueante `XREADGROUP`. Ambos están cubiertos por pruebas y documentados en el README.

Puesta en marcha: `npm install && npm run dev` (Redis en 6379) o `docker compose up --build --scale api=4`; escenario de carga en `test/load/cart.js` (k6).
