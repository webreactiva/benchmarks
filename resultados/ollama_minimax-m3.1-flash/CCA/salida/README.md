# Carrito de la compra escalable

API de carrito de e-commerce diseñada para escalar horizontalmente: **sin estado en
el proceso**, mutaciones **atómicas en Redis**, **control de concurrencia
optimista**, **idempotencia**, **rate limiting distribuido** y **eventos de dominio
transaccionales** (patrón outbox).

```bash
npm install
cp .env.example .env          # opcional: todo tiene valores por defecto
npm run dev                   # API en http://localhost:3000 (requiere Redis)
npm test                      # 42 pruebas: unitarias + integración con Redis real
```

---

## 1. Arquitectura

```
                    ┌──────────────────────────────────────────┐
  cliente ────────▶│  Balanceador (L4/L7, sin afinidad de sesión)│
                    └───────────────┬──────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
        ┌───────────┐         ┌───────────┐         ┌───────────┐
        │  API #1   │         │  API #2   │   ...   │  API #N   │  ← stateless
        └─────┬─────┘         └─────┬─────┘         └─────┬─────┘
              │  (script Lua: mutación atómica + evento)     │
              └─────────────────────┬─────────────────────────┘
                                    ▼
                    ┌───────────────────────────────────┐
                    │  Redis (Sentinel / Cluster)      │
                    │  · carritos (TTL)                 │
                    │  · idempotencia                   │
                    │  · token buckets (rate limit)     │
                    │  · stream de eventos (outbox)     │
                    └───────────────────┬───────────────┘
                                        │
                    ┌───────────────────┴───────────────┐
                    ▼                                   ▼
            ┌───────────────┐                   ┌───────────────┐
            │ Worker #1     │  grupo de         │ Worker #2     │
            │ (eventos)     │  consumidores      │ (eventos)     │
            └───────────────┘                   └───────────────┘
```

Cada petición del ciclo de vida del carrito (`crear → añadir → cambiar cantidad →
cupón → fusionar → checkout`) es una operación **atómica** sobre Redis ejecutada
dentro de un script Lua, de modo que N réplicas concurrentes nunca se pisan entre sí.

---

## 2. Decisiones de escalabilidad

| Tema | Decisión | Por qué |
|---|---|---|
| **Estado** | Vive en Redis, nunca en el proceso | Las réplicas son intercambiables: añadir capacidad es añadir pods, no repartir sesiones |
| **Atomicidad** | Scripts Lua (`src/infrastructure/lua/*.lua`) | Redis ejecuta el script entero de forma atómica: no hay *read-modify-write* ni *lost updates* |
| **Concurrencia** | Versionado optimista (`If-Match` / `x-cart-version`) | Dos ediciones simultáneas producen `409 CART_VERSION_CONFLICT` en lugar de pisarse |
| **Idempotencia** | Cabecera `Idempotency-Key` | Reintentos del cliente o del SDK no duplican efectos; la respuesta original se reproduce |
| **Precios** | Se resuelven siempre en el servidor | El cliente nunca manda importes; el catálogo es la única fuente de verdad |
| **Dinero** | Enteros en céntimos (`unitPriceCents`) | Sin errores de redondeo de coma flotante |
| **Eventos** | Outbox transaccional dentro del propio script Lua | El evento se escribe o no se escribe nunca: no hay estado sin evento ni evento sin estado |
| **Rate limiting** | Token bucket en Redis | El límite es global del servicio, no por réplica |
| **Caché** | LRU local con TTL corto en lecturas | Absorbe el tráfico de lectura (el `GET` de carrito es la operación más frecuente) sin existir estado compartido |
| **Degradación** | Redis caído ⇒ repositorio en memoria | El servicio sigue answering (con pérdida de consistencia entre réplicas) en lugar de devolver 500 |
| **Observabilidad** | Logs JSON, métricas Prometheus, `/healthz` y `/readyz` | Autoscaling y detección de degradación |

### 2.1 El motor de precios está duplicado a propósito

La mutación es atómica **dentro** de Redis, así que el cálculo de totales ocurre
en Lua (`computeTotals` en `cart.lua`). La misma lógica existe en TypeScript
(`src/domain/pricing.ts`) para el repositorio en memoria y para validar.

Ambas implementaciones usan **la misma aritmética entera y el mismo orden de
operaciones**, y `test/integration/lua-parity.test.ts` comprueba que producen
importes idénticos. Si divergieran, el total mostrado y el total cobrado
serían distintos: por eso el test es parte del pipeline.

### 2.2 Control de concurrencia optimista

```bash
# el cliente lee el carrito y guarda su versión
curl -s -D- localhost:3000/v1/carts/$CART_ID | grep -i etag
# ETag: "7"

# al escribir, envía la versión que leyó
curl -X POST localhost:3000/v1/carts/$CART_ID/items \
     -H 'If-Match: "7"' -H 'Content-Type: application/json' \
     -d '{"productId":"prod-tea","quantity":2}'
# 409 {"error":{"code":"CART_VERSION_CONFLICT","details":{"expectedVersion":7,"actualVersion":9}}}
```

Si el cliente **no** envía versión, la operación aplica *last write wins* (útil
para clientes simples), pero las mutaciones siguen siendo atómicas: nunca se
pierde una cantidad añadida.

---

## 3. Puesta en marcha

### Opción A · Docker Compose (Redis + API + worker)

```bash
docker compose up --build --scale api=4
```

`--scale api=4` levanta cuatro réplicas idénticas de la API detrás del mismo
Redis: es la demonstration de que el servicio es stateless.

### Opción B · Local

```bash
docker run -d -p 6379:6379 redis:7-alpine   # o redis-server
npm install
npm run dev            # API
npm run dev:worker     # worker de eventos (otra terminal)
```

### Token de prueba

```bash
npm run token -- usuario-1     # imprime un JWT HS256
```

---

## 4. API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/v1/carts` | Crea un carrito (invitado o autenticado) |
| `GET` | `/v1/carts` | Lista los carritos del usuario autenticado |
| `GET` | `/v1/carts/:cartId` | Lee el carrito (respuesta cacheable en local) |
| `POST` | `/v1/carts/:cartId/items` | Añade un artículo (`{productId, variantId?, quantity}`) |
| `PATCH` | `/v1/carts/:cartId/items/:lineId` | Fija la cantidad de una línea (`{quantity}`) |
| `DELETE` | `/v1/carts/:cartId/items/:lineId` | Elimina una línea |
| `DELETE` | `/v1/carts/:cartId/items` | Vacía el carrito |
| `POST` | `/v1/carts/:cartId/promos` | Aplica un cupón (`{code}`) |
| `DELETE` | `/v1/carts/:cartId/promos/:code` | Retira un cupón |
| `POST` | `/v1/carts/:cartId/merge` | Fusiona el carrito de invitado en el del usuario (`{sourceCartId}`) |
| `POST` | `/v1/carts/:cartId/checkout` | Valida stock y cierra el carrito |
| `GET` | `/healthz` | Liveness |
| `GET` | `/readyz` | Readiness (dependencias) |
| `GET` | `/metrics` | Métricas en formato Prometheus |

**Cabeceras admitidas**

| Cabecera | Uso |
|---|---|
| `Authorization: Bearer <JWT>` | Identifica al usuario |
| `x-session-id` / cookie `sid` | Identifica al invitado (se genera y se devuelve si no existe) |
| `If-Match: "<version>"` | Versión esperada del carrito (concurrencia optimista) |
| `Idempotency-Key: <uuid>` | Hace idempotente la mutación |

**Errores** (`{ "error": { "code", "message", "details"? } }`): `CART_NOT_FOUND`,
`CART_VERSION_CONFLICT`, `CART_ALREADY_CHECKED_OUT`, `INVALID_QUANTITY`,
`PRODUCT_NOT_FOUND`, `OUT_OF_STOCK`, `PROMO_NOT_FOUND`, `RATE_LIMITED`,
`UNAUTHORIZED`, `FORBIDDEN`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`.

### Ejemplo completo

```bash
CART=$(curl -s -X POST localhost:3000/v1/carts -H 'Content-Type: application/json' \
        -H 'x-session-id: sesion-1' -d '{}' | jq -r .id)

curl -s -X POST localhost:3000/v1/carts/$CART/items \
     -H 'Content-Type: application/json' -H 'x-session-id: sesion-1' \
     -H 'Idempotency-Key: 8f0c-...' \
     -d '{"productId":"prod-tea","quantity":3}' | jq .totals
```

---

## 5. Estructura

```
src/
├── domain/          # modelo puro: carrito, dinero, precios, errores, puertos
├── application/     # casos de uso (CartService) e idempotencia
├── infrastructure/  # Redis (scripts Lua), caché LRU, catálogo, rate limiter, eventos
├── http/            # Fastify: rutas, auth, rate limit, errores, métricas
├── observability/   # registro de métricas Prometheus
├── server.ts        # proceso de la API
└── worker.ts        # consumidor de eventos (grupo de consumidores)
test/
├── unit/            # motor de precios, caché LRU, JWT
├── integration/     # API, concurrencia, paridad Lua/TS, outbox, rate limiting
└── load/            # escenario k6
```

---

## 6. Pruebas

```bash
npm test                    # todo
npm run test:unit           # sin Redis
npm run test:integration    # requiere Redis (se arranca solo en el 6399)
```

Las pruebas de integración levantan un Redis efímero, exercised la API completa
y comprueban, entre otras cosas, que **40 altas simultáneas del mismo producto
terminan con 40 unidades** (no hay *lost updates*) y que dos escrituras con la
misma versión producen `200` + `409`.

## 7. Carga

```bash
npm run load            # requiere k6 instalado
```

El escenario `test/load/cart.js` reparte 300 peticiones/s sobre 20 carritos
compartidos (escrituras altamente concurrentes sobre el mismo recurso) y fija
umbrales: `p95 < 200 ms`, `p99 < 500 ms`, `errors < 1 %`.

## 8. Cómo escalar de verdad

1. **Más réplicas de API**: `docker compose up --scale api=8`. No hay afinidad de
   sesión, no hay estado en el proceso y el balanceador puede repartir el
   tráfico como quiera.
2. **Redis en cluster o Sentinel**: el repositorio no usa `KEYS` ni operaciones
   multi-clave (salvo el merge, que usa dos claves *hash-slot* compatibles) y
   todos los scripts son deterministas.
3. **Más workers**: el grupo de consumidores reparte los eventos; los workers
   caídos se recuperan con `XAUTOCLAIM`.
4. **Particionar el catálogo**: `CATALOG_MODE=http` + `CATALOG_URL` para que el
   precio se resuelva en un servicio externo (con timeout y circuit breaker).
5. **Caché distribuida**: hoy la caché de lecturas es local (TTL corto). Con
   varias réplicas, sustituir por Redis/Valkey para invalidación inmediata.

## 9. Notas de implementación

- **Prefijo de claves**: `ioredis` aplica `keyPrefix` a los comandos que conoce,
  pero no a `XGROUP` ni `XINFO` (no tiene definida la posición de la clave).
  Por eso `EventConsumer` crea el grupo sobre la clave *física*
  (`keyPrefix + stream`). Es un detalle fácil de pasar por alto y que rompe el
  worker con `NOGROUP`; hay una prueba que lo cubre.
- **Lecturas bloqueantes**: `XREADGROUP ... BLOCK` debe tener un `commandTimeout`
  de ioredis mayor que el tiempo de bloqueo, o la lectura se aborta. El worker
  usa su propio cliente de Redis con ese margen.
- **Lecturas analíticas**: `TRACK_VIEWS` está desactivado por defecto porque
  convertir cada `GET` en una escritura penaliza precisamente lo que se quiere
  escalar.

## 10. Límites conocidos

- La caché local puede mostrar totales con hasta `CACHE_TTL_MS` de retraso en
  otras réplicas (las mutaciones invalidan siempre la instancia local).
- La validación de stock es orientativa en el carrito; el checkout la repite
  contra el catálogo.
- El outbox usa un stream de Redis: para cargas enormes conviene particionarlo
  por `cartId` o migrar a Kafka/Pulsar manteniendo la misma interfaz.
