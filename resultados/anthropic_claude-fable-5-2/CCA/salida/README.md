# Carrito de la compra escalable

Servicio HTTP de carrito de la compra en Node.js. Los procesos no guardan estado:
todo vive en Redis, así que se escala añadiendo réplicas detrás de un balanceador.

## Puesta en marcha

```bash
npm install

# Desarrollo, sin Redis (almacén en memoria, un solo proceso)
npm start

# Con Redis
REDIS_URL=redis://localhost:6379 npm start

# Varias réplicas + Redis con Docker
docker compose up --build --scale cart=3
```

Tests (`node:test`, sin dependencias extra):

```bash
npm test                                    # almacén en memoria + API
REDIS_URL=redis://localhost:6379 npm test   # además, el mismo contrato contra Redis
```

## API

Los importes son enteros en céntimos.

| Método | Ruta | Cuerpo | Efecto |
|---|---|---|---|
| `GET` | `/carts/:id` | – | Devuelve el carrito (vacío si no existe) |
| `POST` | `/carts/:id/items` | `{"sku": "...", "quantity": 1}` | Suma unidades a una línea |
| `PUT` | `/carts/:id/items/:sku` | `{"quantity": 3}` | Fija la cantidad exacta |
| `DELETE` | `/carts/:id/items/:sku` | – | Elimina la línea |
| `DELETE` | `/carts/:id` | – | Vacía el carrito (204) |
| `GET` | `/healthz` | – | Comprueba el servicio y su almacén |

```bash
curl -X POST localhost:3000/carts/abc/items \
  -H 'Idempotency-Key: 7f3c1e' \
  -d '{"sku":"CAM-001","quantity":2}'
```

```json
{
  "id": "abc",
  "items": [
    { "sku": "CAM-001", "name": "Camiseta básica", "unitPrice": 1299, "quantity": 2, "lineTotal": 2598, "available": true }
  ],
  "totalQuantity": 2,
  "subtotal": 2598,
  "currency": "EUR"
}
```

Errores: `{"error": {"code": "...", "message": "..."}}` con estado 400
(`INVALID_REQUEST`), 404 (`UNKNOWN_SKU`, `NOT_FOUND`), 409 (`CART_LINE_LIMIT`,
`QUANTITY_LIMIT`) o 413 (`PAYLOAD_TOO_LARGE`).

`POST` no es idempotente por naturaleza: si el cliente puede reintentar, debe enviar
una cabecera `Idempotency-Key` única por intención de compra. Las repeticiones con la
misma clave (durante 24 h) no vuelven a sumar. La clave no se compara con el cuerpo:
reutilizarla con otro producto se trata igualmente como repetición.

## Por qué escala

- **Sin estado en el proceso.** Cualquier réplica atiende cualquier petición; no hacen
  falta sesiones pegajosas.
- **Mutaciones atómicas en Redis.** Cada escritura es un único script Lua sobre un
  hash por carrito (`SKU → cantidad`). No hay leer-modificar-escribir en la aplicación
  ni bloqueos distribuidos, y dos réplicas que escriben a la vez en el mismo carrito
  no pierden actualizaciones (hay un test con 200 sumas concurrentes).
- **Coste constante por escritura**, independiente del tamaño del carrito; la lectura
  es un `HGETALL` acotado por el máximo de líneas.
- **Particionable.** Las claves usan la etiqueta `{cartId}`
  (`cart:{id}:items`, `cart:{id}:idem:<clave>`), así que el esquema funciona tal cual en
  Redis Cluster: basta pasar un `Redis.Cluster` de ioredis a `RedisCartStore`.
- **Memoria acotada.** Límites de líneas y unidades por carrito, y TTL renovado en cada
  escritura para que los carritos abandonados caduquen solos.
- **Precios fuera del carrito.** Solo se guardan SKU y cantidad; nombre y precio se
  resuelven en el catálogo en cada lectura. El cliente no puede fijar precios y un
  cambio de precio se refleja sin migrar carritos.

## Estructura

```
src/
  server.js            arranque, configuración y apagado ordenado
  app.js               rutas HTTP y traducción de errores
  cartService.js       validación y cálculo de totales
  catalog.js           interfaz de catálogo + catálogo de ejemplo
  stores/redisStore.js almacén de producción (scripts Lua)
  stores/memoryStore.js almacén para desarrollo y tests
```

## Configuración

| Variable | Por defecto | |
|---|---|---|
| `PORT` | `3000` | |
| `REDIS_URL` | – | Sin ella se usa el almacén en memoria |
| `CART_MAX_LINES` | `100` | Productos distintos por carrito |
| `CART_MAX_QTY_PER_LINE` | `99` | Unidades por producto |
| `CART_TTL_SECONDS` | `2592000` (30 días) | Caducidad desde la última escritura |
| `IDEMPOTENCY_TTL_SECONDS` | `86400` | Vigencia de las claves de idempotencia |

## Fuera del alcance

Antes de usarlo en producción falta lo que depende de tu sistema:

- **Autenticación.** Quien conoce el `id` del carrito puede leerlo y modificarlo. Usa
  identificadores imposibles de adivinar (UUID) o deriva el `id` de la sesión del
  usuario en una capa anterior.
- **Catálogo real.** `sampleCatalog()` es un ejemplo con cuatro productos; sustitúyelo
  por un cliente de tu servicio de productos que implemente `getMany(skus)`.
- **Stock, impuestos, descuentos y checkout.** El carrito no reserva existencias; el
  stock y el precio final deben validarse al crear el pedido.
- **Limitación de peticiones y TLS**, que normalmente resuelve el balanceador o gateway.
