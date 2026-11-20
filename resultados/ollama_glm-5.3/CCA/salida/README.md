# 🛒 Carrito de la compra escalable

API REST de carrito de la compra en **Node.js + TypeScript**, con **arquitectura
hexagonal** (puertos y adaptadores), persistencia **SQLite** (nativa de Node, sin
dependencias que compilar) y una **interfaz web** de demostración sin build de
frontend.

```bash
npm install
npm run dev          # http://localhost:3000
```

| Comando           | Qué hace                                     |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Servidor en caliente con recarga (`tsx`)     |
| `npm run build`   | Compila TypeScript a `dist/`                 |
| `npm start`       | Ejecuta la build                             |
| `npm test`        | Tests unitarios (vitest)                     |
| `npm run typecheck` | Comprobación de tipos sin emitir           |

> Requiere **Node ≥ 22.5** (usa el módulo nativo `node:sqlite`; arrancar con él
> emite un aviso de "experimental" que se puede ignorar).

---

## Decisiones de diseño (el "escalable" de verdad)

| Decisión | Por qué |
| --- | --- |
| **Arquitectura hexagonal** | El dominio y los servicios no conocen ni Express ni SQL. Sustituir SQLite por PostgreSQL es escribir un adaptador nuevo: ningún otro archivo cambia. |
| **Dinero en céntimos enteros** | `priceCents: 1234` = 12,34 €. Operar con euros en coma flotante es un bug clásico (0.1 + 0.2 ≠ 0.3). |
| **El carrito solo guarda `productId` + cantidad** | Los precios se resuelven contra el catálogo en cada lectura: datos siempre frescos y es imposible manipular precios desde el cliente. |
| **Una sola fuente de precios** | Todo el desglose (descuentos, envío, IVA, redondeos) vive en `PricingService`. Redondeo por concepto, la suma siempre cuadra. |
| **Un único punto de traducción de errores** | Cada error de dominio sabe su `code` y su estado HTTP; el middleware lo traduce. Añadir casos no obliga a tocar la capa HTTP. |
| **API sin estado** | No hay sesiones: el cliente guarda su `cartId`. Escalar horizontalmente es añadir réplicas y compartir la BD. |
| **Endpoints thin, servicio grueso** | Las rutas solo validan la forma de la petición y delegan. Los casos de uso se prueban sin HTTP. |
| **Sin dependencias de base de datos** | `node:sqlite` viene con Node. Cero módulos nativos que compilar. |

## Arquitectura

```
┌──────────────────────── HTTP — adaptador de entrada ───────────────────────┐
│ http/routes/*  http/middleware/error-handler.ts  http/app.ts   public/*(UI) │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    ▼
┌───────────────────────── Aplicación y dominio ──────────────────────────────┐
│ services/cart-service.ts   casos de uso del carrito                         │
│ services/pricing-service  reglas de precio (descuentos, envío, IVA)         │
│ domain/*                  entidades, invariantes y errores de negocio      │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │ depende solo de interfaces
┌───────────────▼──────── ports/repositories.ts ──────────────────────────────┐
│        CartRepository  ·  ProductRepository                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ adapters/sqlite/*   adapters/memory/*   (futuro: adapters/postgres/*…)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

```
src/
├── index.ts                # arranque: elige adaptadores y enciende el servidor
├── config.ts               # configuración por variables de entorno
├── catalog.ts              # catálogo inicial (siembra idempotente en la BD)
├── domain/                 # entidades y errores (cero dependencias)
├── ports/                  # interfaces de persistencia (los "puertos")
├── services/               # casos de uso y reglas de precio
├── adapters/
│   ├── sqlite/             # implementación de los puertos con node:sqlite
│   └── memory/             # implementación en memoria (tests, STORAGE=memory)
└── http/                   # Express: rutas, middleware y fábrica de la app
public/                     # UI de demostración (HTML/CSS/JS sin build)
tests/                      # tests unitarios con vitest
```

## Configuración

Todas las variables son opcionales y tienen un valor por defecto sensato:

| Variable | Defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP |
| `STORAGE` | `sqlite` | `sqlite` o `memory` (datos volátiles) |
| `DB_FILE` | `data/cart.db` | Ruta del archivo SQLite (`:memory:` permitido) |
| `TAX_RATE` | `0.21` | IVA sobre el importe gravable |
| `SHIPPING_CENTS` | `499` | Coste de envío en céntimos |
| `FREE_SHIPPING_THRESHOLD_CENTS` | `5000` | Envío gratis a partir de este importe (ya descontado) |
| `DISCOUNT_CODES` | (ver abajo) | JSON con códigos activos |

Códigos de descuento por defecto: `BIENVENIDA10` (−10 %), `GASTA50` (−5 % a
partir de 50 €) y `CINCOEUROS` (−5 €).

Ejemplo de `DISCOUNT_CODES`:

```json
{"VERANO20":{"type":"percent","value":20},"PRIMERA":{"type":"fixed","value":300,"minSubtotalCents":1000}}
```

## API REST

Respuesta de error uniforme: `{"error": {"code", "message", "details"}}`.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/products` | Listado del catálogo |
| `GET` | `/api/products/:id` | Un producto |
| `POST` | `/api/carts` | Crea un carrito vacío → `201` |
| `GET` | `/api/carts/:cartId` | Carrito con desglose de precios |
| `POST` | `/api/carts/:cartId/items` | Añade unidades a una línea `{productId, quantity?}` → `201` |
| `PATCH` | `/api/carts/:cartId/items/:productId` | Fija la cantidad de la línea `{quantity}` (0 elimina) |
| `DELETE` | `/api/carts/:cartId/items/:productId` | Elimina la línea |
| `DELETE` | `/api/carts/:cartId` | Vacía el carrito (mantiene su identidad) |
| `POST` | `/api/carts/:cartId/discount` | Aplica un código `{code}` |
| `DELETE` | `/api/carts/:cartId/discount` | Quita el código |
| `POST` | `/api/carts/:cartId/checkout` | Valida stock, lo descuenta y cierra el pedido → `201` |

Códigos de error: `CART_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `CART_ITEM_NOT_FOUND`,
`OUT_OF_STOCK` (409), `INVALID_QUANTITY`, `INVALID_REQUEST` (400),
`INVALID_DISCOUNT_CODE`, `DISCOUNT_MIN_SUBTOTAL` (422), `EMPTY_CART` (409).

### Probado con curl

```bash
curl -s http://localhost:3000/api/products | head -40

CART=$(curl -s -X POST http://localhost:3000/api/carts | node -pe "JSON.parse(require('fs').readFileSync(0)).id")

curl -s -X POST http://localhost:3000/api/carts/$CART/items \
  -H 'Content-Type: application/json' \
  -d '{"productId":"p-raton","quantity":2}'

curl -s -X POST http://localhost:3000/api/carts/$CART/discount \
  -H 'Content-Type: application/json' \
  -d '{"code":"BIENVENIDA10"}'

curl -s -X POST http://localhost:3000/api/carts/$CART/checkout
```

## Reglas de negocio vigentes

- Cantidades enteras de 1 a 99 por línea; fusionan si el producto ya está.
- No se puede añadir más que el stock disponible (`OUT_OF_STOCK`, 409).
- El envío es gratis a partir de 50 € **ya descontados**; un carrito vacío no paga envío.
- Descuentos re-evaluados en cada lectura: si bajas del mínimo, deja de aplicarse.
- El checkout re-valida y descuenta el stock atómicamente por línea; si falla a
  mitad, compensa lo descontado y el carrito queda intacto para reintentar.

## Cómo extender

- **Otra base de datos**: implementa `CartRepository` y `ProductRepository`
  (`src/ports/repositories.ts`) en `src/adapters/postgres/` y elígelo en
  `src/index.ts`. Nada más cambia.
- **Nueva estrategia de descuento**: añade un tipo a `DiscountRule.type`
  (`'freeship'`, `'bundle'`…) y su rama en `PricingService.price()`.
- **Otro protocolo de entrada** (GraphQL, gRPC, CLI): los casos de uso ya son
  independientes de HTTP; solo hace falta otro adaptador de entrada.
- **Autenticación / usuarios**: un middleware más en `src/http/` y un campo
  `userId` opcional al crear el carrito; el dominio no cambia.
- **Transacción real en el checkout**: hoy se compensa a mano; el paso natural
  es un patrón *unit of work* compartido por los adaptadores.

## Tests

```bash
npm test
```

Cubren el motor de precios (redondeos, mínimos, envío gratis) y todos los casos
de uso del carrito (fusiones, stock, códigos, checkout con compensación de
stock) usando los adaptadores en memoria: sin red ni disco, en milisegundos.
