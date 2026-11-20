I'll start by exploring the current folder to understand the project setup.

---

Empty folder — I'll build the whole project from scratch. Let me plan the architecture first.

---

Now the core domain package:

---

Now the pricing engine and application ports:

---

Now let me fix the imports in the cart service:

---

Now the remaining in-memory adapters (stock, pricing rules, cache, events, idempotency):

---

Core compiles. Now the server package:

---

Now the Redis adapters (the scalable persistence layer):

---

Now the HTTP layer — serializers, plugins and routes:

---

Server compiles. Now let me write tests and verify the API end-to-end:

---

Now let me attach the JSON schemas to the routes:

---

All tests pass. Now the React client:

---

Now the React components:

---

Now the README with the design documentation:

---

Listo. He implementado un carrito de la compra escalable completo en la carpeta actual.

## Qué hay

Monorepo con3 paquetes (arquitectura hexagonal, dominio sin dependencias):

| Paquete | Contenido |
|---|---|
| `packages/core` | Dominio puro: carrito, líneas con *snapshot* de precio, `Money` en céntimos (nada de float), políticas inyectables, motor de precios, `CartService`, puertos y adaptadores en memoria de referencia |
| `packages/server` | API Fastify (sin estado) + adaptadores Redis, idempotencia, métricas Prometheus, SSE, health checks, *graceful shutdown* |
| `packages/client` | Storefront React + Vite: catálogo, panel de carrito, cupones, totales, sincronización en vivo y gestión de conflictos |

## Decisiones de escalabilidad

- **Sin estado en la API**: el carrito vive en Redis → N réplicas detrás del balanceador.
- **Concurrencia sin bloqueos**: CAS por `version` con script Lua; la mutación es una función pura, así que ante conflicto se relee y se reaplica (nunca se pierde una línea).
- **Atomicidad en Lua**: alta por lotes, reserva de stock (todo o nada) y reclamo de la clave de idempotencia.
- **Idempotencia** con `Idempotency-Key` (replay de la respuesta original, 409 si cambia el payload).
- **Claves con hash tags** `{cartId}` → compatibles con Redis Cluster.
- **Caché read-through del catálogo** con *negative caching* y petición por lotes.
- **Outbox + pub/sub** para que los efectos colaterales no bloqueen la escritura.
- Extras: rate limiting, SSE, `/health/live|ready`, `/metrics`, logs con `requestId`.

## Verificación (todo en verde)

```
npm run build      ✓ npm run typecheck  ✓   npm run lint  ✓
npm test           → 69 tests (dominio + API + integración con Redis real)
npm run smoke      → end-to-end contra el binario compilado
```

Probé además el modo dev (`tsx` + `vite` con proxy) y el stream SSE con Redis real recibiendo los eventos de `cart.item_added`.

Dos notas: la identidad de cliente usa la cabecera `x-customer-id` como *stand-in* de un JWT (el punto de extensión es `http/plugins/context.ts`), y los cupones/promociones salen de un proveedor en memoria detrás del puerto `PricingRulesProvider` — el README documenta ambas limitaciones y los siguientes pasos.
