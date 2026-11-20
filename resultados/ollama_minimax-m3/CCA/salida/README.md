# Carrito de la compra escalable

Carrito de compra completo y **escalable horizontalmente**: API REST sin estado
sobre Fastify, persistencia compartida en Redis con scripts Lua atómicos,
dominio puro en TypeScript y un storefront en React que se sincroniza en vivo.

```
┌──────────────┐    HTTP/JSON     ┌──────────────────────────────┐
│  React SPA   │ ───────────────▶ │  API Fastify (sin estado)   │  × N réplicas
│  (Vite)      │ ◀─── SSE ─────── │  auth · rate limit · metric │
└──────────────┘                  └───────────────┬──────────────┘
                                                │ puertos
                                   ┌────────────▼─────────────┐
                                   │  @cart/core (dominio)     │
                                   │  carrito · precios · pol. │
                                   └────────────┬─────────────┘
                                                │ adaptadores
                        ┌───────────────────────┼───────────────────────┐
                        ▼                       ▼                       ▼
                 ┌─────────────┐         ┌─────────────┐        ┌─────────────┐
                 │ Redis       │         │ Catálogo    │        │ Outbox /    │
                 │ (carritos,  │         │ (HTTP/seed) │        │ bus eventos │
                 │  stock, idem)│        │ + caché     │        │ (pub/sub)   │
                 └─────────────┘         └─────────────┘        └─────────────┘
```

## Puesta en marcha

```bash
npm install

# 1) Estado compartido (opcional en local, necesario para escalar)
docker compose up -d redis

# 2) Arrancar API (:3000) y storefront (:5173) en modo desarrollo
npm run dev

# 3) Verificación completa
npm run build && npm test && npm run lint && npm run smoke
```

El storefront usa el proxy de Vite (`/api` → `http://localhost:3000`), por lo que
no hace falta configurar CORS en desarrollo.

| Script                            | Qué hace                                            |
| --------------------------------- | --------------------------------------------------- |
| `npm run dev`                     | API (`tsx watch`) + storefront (`vite`) en paralelo |
| `npm run build`                   | Compila `@cart/core`, `@cart/server` y el cliente   |
| `npm test`                        | 63 tests (dominio + API)                            |
| `npm run test:redis`              | Añade la suite de integración contra un Redis real  |
| `npm run lint` / `npm run format` | ESLint + Prettier                                   |
| `npm run smoke`                   | Test end-to-end contra el servidor compilado        |
| `npm run typecheck`               | `tsc` en los tres paquetes                          |

---

## Arquitectura

Monorepo con workspaces npm y **arquitectura hexagonal** (puertos y adaptadores).
El dominio no depende de nada: ni de HTTP, ni de Redis, ni del framework.

| Paquete           | Contenido                                                                                                              | Dependencias         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `packages/core`   | Modelo de dominio, motor de precios, políticas, servicio de aplicación, puertos y adaptadores en memoria de referencia | **cero**             |
| `packages/server` | API Fastify, adaptadores Redis, idempotencia, métricas, SSE, _composition root_                                        | fastify, redis, pino |
| `packages/client` | Storefront React + Vite                                                                                                | react                |

### Capas

```
packages/core/src
├── domain/          entidades, value objects, errores, políticas, eventos
├── application/     CartService, motor de precios, puertos (interfaces)
├── adapters/memory/ implementaciones de referencia (tests y modo single node)
└── shared/          reloj e identificadores inyectables

packages/server/src
├── config.ts        configuración por entorno, validada
├── container.ts     composition root: elegimos los adaptadores
├── app.ts           servidor Fastify (plugins, hooks, métricas)
├── http/            rutas, serializadores, plugins (contexto, errores, idempotencia)
├── adapters/redis/  repositorio de carritos, stock, caché, idempotencia, bus
├── adapters/http/   cliente del catálogo externo
└── observability/   logger estructurado, registro de métricas
```

### Modelo de dominio

- **`Cart`** —Aggregate root. Contiene líneas, cupones, estado (`active`,
  `converted`, `abandoned`), `currency` y un **`version`** que actúa como
  candado optimista.
- **`CartLine`** —Una línea por producto. Guarda una **foto del precio**
  (`unitPrice`) tomada al añadirlo: el total que ve el usuario nunca cambia
  bajo sus pies.
- **`Money`** —Entero en céntimos + divisa. **Nunca** se usa punto flotante
  para el dinero, así los totales son exactos y reproducibles entre réplicas.
- **Políticas** (`CartPolicies`) —Límites inyectables: unidades por línea,
  líneas distintas, unidades por carrito, estrategia de fusión y TTL.
- **Errores de dominio** —Cada fallo tiene un `code` estable
  (`CART_CONFLICT`, `INSUFFICIENT_STOCK`…) que la capa HTTP traduce a status.

### Motor de precios

Función pura `priceCart(cart, promociones, cupones, envío, impuestos)`:

1. `subtotal` = Σ (precio × cantidad)
2. **Promociones automáticas** (por prioridad), luego **cupones**, sobre el
   importe restante.
3. Envío: tarifa plana, gratis por umbral o por cupón; un carrito vacío no paga envío.
4. Base imponible = (subtotal − descuentos) + envío → impuestos → total.

El descuento total se reparte entre las líneas con el **método del resto mayor**
(`allocate`), de forma que la suma de las partes es exactamente el total: no se
pierden céntimos al redondear.

---

## Por qué escala

### 1. API sin estado, estado compartido

La API no guarda nada en el proceso: el carrito vive en Redis. Se pueden
desplegar N réplicas detrás de un balanceador; cualquier réplica sirve cualquier
petición.

```
cart:{<cartId>}             → JSON del carrito        (hash tag = cartId)
cart:index:{<customerId>}   → set de carritos del cliente
cart:stock:{stock}:<sku>    → stock disponible
cart:idem:{<key>}           → registro de idempotencia
cart:events                 → canal pub/sub de eventos
cart:outbox:events          → outbox durable de eventos
```

Las llaves usan _hash tags_ (`{...}`) de Redis Cluster: cada operación sobre un
carrito cae siempre en el mismo shard, y los scripts Lua multi-llave siguen
siendo atómicos.

### 2. Concurrencia sin bloqueos: compare-and-set

No hay mutexes ni bloqueos distribuidos. Cada escritura es un CAS sobre la
versión:

```lua
-- scripts: SAVE_CART_SCRIPT
if tonumber(decoded['version']) ~= tonumber(ARGV[1]) then
  return {'conflict', tostring(decoded['version'])}
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
```

La mutación del dominio es una **función pura** (`addLine`, `setLineQuantity`…),
así que ante un conflicto el servicio **relee y vuelve a aplicar** la mutación
(hasta 5 intentos con backoff). Nunca se pierde una línea por una carrera.

Ventajas frente a los bloqueos: sin timeouts, sin estados «dead» y sin
bloquear a otras réplicas.

### 3. Escrituras atómicas con Lua

Añadir varios productos es **una sola escritura**: o entra la cesta completa o
no entra nada. Lo mismo con la reserva de stock (todo o nada) y con el reclamo
de una clave de idempotencia.

### 4. Idempotencia

Cabecera `Idempotency-Key` opcional. La clave se **reclama de forma atómica**
antes de ejecutar la operación; si llega el mismo `Idempotency-Key` con el mismo
payload se devuelve la respuesta grabada (`idempotent-replay: true`), y con un
payload distinto se responde `409 IDEMPOTENCY_CONFLICT`.

Es lo que evita el clásico «el usuario ha pulsado dos veces y tiene dos carritos»
o un doble cobro por reintento de red.

### 5. Cache del catálogo

El catálogo se lee mucho más de lo que se escribe. El carrito lo consume a
través de una caché _read-through_ (TTL configurable, con _negative caching_):

- una petición por lote (`getProducts`) en lugar de una por línea,
- el carrito sigue funcionando aunque el catálogo externo esté caído,
- el catálogo puede ser un seed local (`CATALOG_SOURCE=seed`) o un servicio HTTP
  (`CATALOG_SOURCE=http` + `CATALOG_URL`).

### 6. Eventos desacoplados (outbox + pub/sub)

Cada cambio de carrito publica un evento de dominio en un canal de Redis
(`cart:events`) y lo deja en una outbox durable. Los consumidores (SSE, analítica,
email, búsqueda) se suscriben **sin bloquear la escritura**. Si un publicador
falla, la operación del usuario **nunca** falla por ello.

### 7. Observabilidad y operación

- `GET /health/live` y `GET /health/ready` (comprueba Redis) para orquestadores.
- `GET /metrics` con formato Prometheus (contadores, histogramas, gauges).
- Logs estructurados con `requestId` por petición.
- `SIGTERM` → _graceful shutdown_: se deja de aceptar, se cierran las conexiones
  y se cierra Redis.
- _Rate limiting_ por cliente (`@fastify/rate-limit`).

### 8. Degradación elegante

| Fallo                      | Comportamiento                                           |
| -------------------------- | -------------------------------------------------------- |
| Redis caído                | `/health/ready` → `503`; el tráfico se drena del nodo    |
| Catálogo caído             | Se sirve la copia cacheada; si no hay copia, error claro |
| Dos escrituras simultáneas | Una recibe `409` y el cliente recarga el carrito         |
| Reintento del cliente      | La clave de idempotencia devuelve la respuesta original  |

---

## API

Base: `/api/v1`. Identidad del cliente mediante la cabecera `x-customer-id`
(un carrito sin dueño es un carrito de invitado, que se reclama al primer uso de
un cliente autenticado).

| Método   | Ruta                                     | Descripción                                             |
| -------- | ---------------------------------------- | ------------------------------------------------------- |
| `GET`    | `/api/v1/products`                       | Catálogo (`?category`, `?search`, `?limit`, `?offset`)  |
| `POST`   | `/api/v1/carts`                          | Crea un carrito (`201`)                                 |
| `GET`    | `/api/v1/carts`                          | Carritos del cliente autenticado                        |
| `GET`    | `/api/v1/carts/:cartId`                  | Carrito + totales calculados                            |
| `POST`   | `/api/v1/carts/:cartId/items`            | Añade `{productId, quantity}` o `{items:[…]}` (atómico) |
| `PATCH`  | `/api/v1/carts/:cartId/items/:productId` | Cantidad absoluta (`0` elimina)                         |
| `DELETE` | `/api/v1/carts/:cartId/items/:productId` | Elimina la línea                                        |
| `DELETE` | `/api/v1/carts/:cartId/items`            | Vacía el carrito                                        |
| `POST`   | `/api/v1/carts/:cartId/coupons`          | Aplica un cupón                                         |
| `DELETE` | `/api/v1/carts/:cartId/coupons/:code`    | Quita un cupón                                          |
| `POST`   | `/api/v1/carts/:cartId/merge`            | Fusiona un carrito de invitado (`{sourceCartId}`)       |
| `POST`   | `/api/v1/carts/:cartId/checkout`         | Reserva stock y cierra el carrito                       |
| `GET`    | `/api/v1/carts/:cartId/events`           | Stream SSE con los eventos del carrito                  |

Cabeceras especiales: `Idempotency-Key`, `x-request-id`, `x-customer-id`.

Los errores usan un documento de problema uniforme:

```json
{
  "error": {
    "code": "CART_CONFLICT",
    "message": "Cart \"c1\" was modified concurrently (expected version 3, current 4)",
    "details": { "cartId": "c1", "expectedVersion": 3, "actualVersion": 4 },
    "requestId": "0e1c…"
  }
}
```

---

## Storefront

`packages/client` es una SPA en React que:

- muestra el catálogo con búsqueda y filtro por categoría,
- mantiene el carrito sincronizado con la API y con **SSE** (otra pestaña o
  otro dispositivo actualizan el panel en vivo),
- gestiona los **409** recargando el carrito y avisando al usuario,
- aplica cupones (`BIENVENIDA10`, `ENVIOGRATIS`, `VERANO25`) y muestra el
  desglose de totales,
- guarda el `cartId` en `localStorage` para sobrevivir a las recargas.

---

## Configuración

Todo por variables de entorno (ver `.env.example`):

| Variable                  | Por defecto        | Descripción                                                                 |
| ------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `PORT` / `HOST`           | `3000` / `0.0.0.0` | Escucha del servidor                                                        |
| `REDIS_URL`               | _(vacío)_          | Estado compartido; sin él se usan los adaptadores en memoria (un solo nodo) |
| `REDIS_KEY_PREFIX`        | `cart:`            | Prefijo de las llaves                                                       |
| `MAX_QUANTITY_PER_LINE`   | `10`               | Unidades máximas por línea                                                  |
| `MAX_DISTINCT_LINES`      | `50`               | Líneas máximas por carrito                                                  |
| `MAX_UNITS_PER_CART`      | `100`              | Unidades máximas por carrito                                                |
| `CART_TTL_SECONDS`        | `2592000`          | Caducidad de un carrito abandonado                                          |
| `CART_WRITE_RETRIES`      | `5`                | Reintentos ante conflicto de versión                                        |
| `IDEMPOTENCY_TTL_SECONDS` | `86400`            | Vida de una clave de idempotencia                                           |
| `TAX_RATE`                | `0.21`             | Tipo impositivo                                                             |
| `SHIPPING_FLAT_AMOUNT`    | `499`              | Envío plano (céntimos)                                                      |
| `FREE_SHIPPING_THRESHOLD` | `5000`             | Envío gratis a partir de (céntimos)                                         |
| `CATALOG_SOURCE`          | `seed`             | `seed` u `http`                                                             |
| `CATALOG_URL`             | —                  | Catálogo externo                                                            |
| `CATALOG_CACHE_TTL_MS`    | `30000`            | TTL de la caché de catálogo                                                 |
| `RATE_LIMIT_MAX`          | `300`              | Peticiones por ventana y cliente                                            |
| `LOG_LEVEL`               | `info`             | Nivel de log (pino)                                                         |

---

## Pruebas

```
packages/core/test     money · dominio del carrito · motor de precios · servicio
packages/server/test   API completa con `app.inject()` + suite contra Redis real
```

```bash
npm test                                              # todo
REDIS_TEST_URL=redis://localhost:6379 npm test       # incluye la suite de Redis
npm run smoke                                         # end-to-end sobre el binario
```

La suite de Redis verifica persistencia entre instancias, el CAS de Redis, la
idempotencia distribuida y la reserva atómica de stock.

---

## Limitaciones conocidas y siguientes pasos

- **Autenticación**: la cabecera `x-customer-id` es un stand-in; en producción
  debe validarse un JWT emitido por el gateway. El punto de extensión es
  `http/plugins/context.ts`.
- **Cupones y promociones** se sirven desde memoria (`InMemoryPricingRules`).
  El puerto `PricingRulesProvider` ya está definido para conectarlos a una base
  de datos o a un servicio de promotions.
- **Reserva de stock** usa el hash tag `{stock}` para ser atómica en Cluster;
  con un catálogo muy caliente conviene particionar por vendedor y aceptar una
  reserva en _saga_ en lugar de una reserva global.
- **Carritos muy grandes**: el carrito se guarda como un único documento JSON.
  Con más de ~100 líneas conviene pasar a un hash por línea (la interfaz
  `CartRepository` ya lo permite).
- Siguientes pasos naturales: _outbox_ con reintentos y _dead letter queue_,
  projection de carritos en Elasticsearch, y CDN para el catálogo.
