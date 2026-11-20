# scalable-cart

Carrito de la compra escalable: API REST en **Node.js + TypeScript + Fastify**, organizada en capas (dominio → aplicación → infraestructura → HTTP) con concurrencia optimista, cupones, cálculo de totales e inventario.

## Arranque

```bash
npm install
npm run dev        # desarrollo (tsx)
npm test           # tests (vitest)
npm run typecheck  # tsc --noEmit
npm run build && npm start
```

Servidor en `http://localhost:3000` (configurable con `PORT`, `HOST`).

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/v1/products` | Catálogo (demo) |
| POST | `/api/v1/carts` | Crear carrito `{ ownerId? }` |
| GET | `/api/v1/carts/:cartId` | Obtener carrito con totales |
| POST | `/api/v1/carts/:cartId/items` | Añadir `{ productId, quantity, expectedVersion? }` |
| PATCH | `/api/v1/carts/:cartId/items/:productId` | Cambiar cantidad `{ quantity, expectedVersion? }` (0 = eliminar) |
| DELETE | `/api/v1/carts/:cartId/items/:productId` | Eliminar línea |
| DELETE | `/api/v1/carts/:cartId/items` | Vaciar carrito |
| POST | `/api/v1/carts/:cartId/coupon` | Aplicar cupón `{ code }` |
| DELETE | `/api/v1/carts/:cartId/coupon` | Quitar cupón |
| POST | `/api/v1/carts/:cartId/checkout` | Confirmar pedido |

### Concurrencia optimista

Cada mutación acepta `expectedVersion` (en el body, o cabecera `x-cart-version`, o query `?expectedVersion=`). Si no coincide con la versión actual del carrito, la API responde `409 VERSION_CONFLICT` con `currentVersion`. El repositorio aplica la comprobación de forma atómica (compare-and-set).

### Dinero

Todos los importes son enteros en **céntimos** (`*Cents`) en la moneda indicada (`CURRENCY`, por defecto EUR). Totales: subtotal → descuento de cupón → impuestos (`TAX_RATE`) → envío (gratis a partir de `FREE_SHIPPING_THRESHOLD_CENTS`, si no `SHIPPING_FLAT_CENTS`).

Configuración por entorno: `TAX_RATE`, `FREE_SHIPPING_THRESHOLD_CENTS`, `SHIPPING_FLAT_CENTS`, `CURRENCY`, `CART_TTL_DAYS` (0 = sin caducidad).

Cupones de ejemplo: `WELCOME10` (10 %), `TECH50` (50 € desde 200 €), `SAVE5` (5 €).

## Arquitectura

```
src/
  domain/          Lógica pura, sin dependencias: Cart, pricing (totales/cupones),
                   errores de dominio, eventos de dominio
  application/     Casos de uso (CartService) + puertos (interfaces de repositorio,
                   catálogo, cupones y bus de eventos)
  infrastructure/  Implementaciones: InMemory* (listas para sustituir)
  http/            Rutas Fastify + validación Zod + mapeo error→HTTP
```

Decisiones clave para escalar:

- **API stateless**: cualquier instancia sirve cualquier petición; el estado vive en el repositorio. Escalado horizontal detrás de un balanceador.
- **Patrón repositorio** (`CartRepository`, `ProductCatalog`, `CouponRepository`): la implementación in-memory es intercambiable por Redis (`WATCH`/Lua o `SET ... XX` con versión) o Postgres (`UPDATE ... WHERE version = $n`) sin tocar dominio ni casos de uso.
- **Concurrencia optimista** vía versión por carrito: evita locks distribuidos.
- **Eventos de dominio** (`cart.created`, `cart.item_added`, `cart.checked_out`, …) publicados tras cada commit, listos para un outbox transaccional → Kafka/SQS para analítica, email, etc.
- **TTL de carrito** con expiración perezosa (listo para un job de limpieza o TTL nativo de Redis).
- **Checkout**: revalida stock y aforo de cupón, decrementa inventario y confirma en una operación; en un entorno real multi-instancia se hace con reserva de stock + saga/outbox.
- **Catálogo como puerto**: el servicio no sabe de dónde vienen los productos (DB, API externa de inventario…).

### Sustituir la persistencia por Redis (esbozo)

```ts
class RedisCartRepository implements CartRepository {
  // insert: SET cart:{id} value NX
  // save:   WATCH cart:{id}; GET; comparar version; MULTI SET cart:{id}; EXEC
  // getById: GET + SETEX con TTL
}
```

## Notas

- La publicación de eventos es posterior al commit; si el bus falla, el error se loguea pero no revierte la escritura. En producción: outbox transaccional.
- In-memory implica un único proceso; para múltiples réplicas usar Redis/Postgres.
