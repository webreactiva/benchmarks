# Carrito de la compra escalable

Servicio de carrito en Node.js (≥ 20), **sin dependencias** en el modo por defecto.
Arquitectura hexagonal, procesos sin estado y concurrencia optimista: se puede
escalar horizontalmente añadiendo réplicas detrás de un balanceador.

```bash
npm start                 # http://localhost:3000, almacén en memoria
npm test                  # 19 tests (node:test)

npm i ioredis
REDIS_URL=redis://localhost:6379 CLUSTER=1 npm start   # un worker por CPU, estado en Redis
```

## Estructura

```
src/
  domain/            Lógica pura, sin E/S
    cart.js          Agregado Carrito (inmutable, serializable, con límites)
    pricing.js       Motor de precios con reglas enchufables
    money.js         Dinero en céntimos enteros
    errors.js        Errores de dominio → códigos HTTP
  application/
    cartService.js   Casos de uso + concurrencia optimista con reintentos
  infrastructure/
    inMemoryCartRepository.js   Repositorio en memoria (dev/tests)
    redisCartRepository.js      Repositorio Redis (producción, multi-réplica)
    adapters.js                 Catálogo, cupones, bus de eventos, idempotencia
  http/server.js     API REST (node:http)
  container.js       Inyección de dependencias + datos de ejemplo
  index.js           Arranque, modo cluster, apagado ordenado
test/                Dominio, servicio, HTTP y adaptador Redis
```

## Por qué escala

| Problema | Solución |
|---|---|
| Varias réplicas | Los procesos no guardan estado; el carrito vive en el repositorio (Redis). |
| Escrituras simultáneas (dos pestañas, dos réplicas) | Cada carrito tiene `version`. Se guarda con *compare-and-set* atómico (script Lua en Redis). Ante conflicto, el servicio vuelve a leer y reaplica la operación (backoff con jitter). Sin locks distribuidos. |
| El cliente decide sobre datos viejos | `ETag` / `If-Match` → `409 VERSION_CONFLICT`. |
| Reintentos de red, doble clic | Cabecera `Idempotency-Key`: la segunda petición devuelve el resultado de la primera. |
| Muchos carritos | En Redis Cluster las claves `cart:{id}` se reparten por *hash slot*; un carrito = una clave. |
| Carritos abandonados | TTL (30 días por defecto) renovado en cada escritura. |
| Precios manipulados por el cliente | El cliente solo envía `sku` y cantidad; precio, nombre y stock salen del catálogo. Al ver el carrito se repreciona y se avisa de cambios (`PRICE_CHANGED`, `PRODUCT_UNAVAILABLE`, `INSUFFICIENT_STOCK`, `COUPON_INVALID`). |
| Nuevas promociones | `registerRuleType('mi_regla', fn)` en `pricing.js`; no hay que tocar carrito ni servicio. |
| Integraciones (analítica, emails de recuperación…) | Cada cambio publica un evento (`cart.item_added`, `cart.merged`…) en el bus; sustituible por Kafka/SNS/Redis Streams. |
| Abuso | Límites de líneas, unidades y cupones; cuerpo máximo de 16 KB; validación de SKU y cupones. |

Para cambiar cualquier pieza (p. ej. catálogo real, DynamoDB como almacén)
basta con implementar la misma interfaz, documentada en la cabecera de cada
adaptador, y conectarla en `container.js`.

## API

Importes en **céntimos**. Precios de catálogo sin IVA; IVA 21 %, envío 4,99 €
gratis desde 50 € (configurable en `DEFAULT_PRICING`).

| Método | Ruta | Cuerpo |
|---|---|---|
| POST | `/carts` | `{ ownerId?, currency? }` |
| GET | `/carts/:id` | — |
| DELETE | `/carts/:id` | — |
| POST | `/carts/:id/items` | `{ sku, quantity? }` (suma) |
| PATCH | `/carts/:id/items/:sku` | `{ quantity }` (fija; 0 elimina) |
| DELETE | `/carts/:id/items/:sku` | — |
| DELETE | `/carts/:id/items` | — (vaciar) |
| POST | `/carts/:id/coupons` | `{ code }` |
| DELETE | `/carts/:id/coupons/:code` | — |
| POST | `/carts/:id/merge` | `{ sourceCartId }` (invitado → usuario al hacer login) |
| GET | `/health` | — |

Ejemplo:

```bash
ID=$(curl -s -XPOST localhost:3000/carts -d '{}' | jq -r .id)
curl -s -XPOST localhost:3000/carts/$ID/items -d '{"sku":"SUDADERA-GRIS-L","quantity":2}'
curl -s -XPOST localhost:3000/carts/$ID/coupons -d '{"code":"MENOS5"}'
# → subtotal 7000, discountTotal 500, shipping 0, tax 1365, total 7865
```

Errores: `{ "error": { "code", "message", "details" } }` con 400 (validación),
404, 405, 409 (versión), 422 (stock o límites).

Datos de ejemplo: productos `CAMISETA-AZUL-M`, `TAZA-LOGO`, `SUDADERA-GRIS-L`,
`PEGATINAS`; cupones `BIENVENIDA10` (-10 %), `MENOS5` (-5 € desde 30 €),
`TAZAS3X2`.

## Limitaciones conocidas

- El adaptador Redis está probado con un cliente simulado, **no contra un Redis real**.
- El almacén de idempotencia, el catálogo, los cupones y el bus de eventos que
  vienen incluidos son en memoria (válidos para una sola instancia). Con varias
  réplicas hay que sustituirlos (idempotencia en Redis con `SET NX PX`, etc.).
- La reserva de stock no forma parte del carrito: el stock se comprueba al añadir
  y al ver, pero la reserva definitiva corresponde al checkout.
