# Carrito de la Compra Escalable

Implementación de un servicio de **Carrito de la Compra** en **TypeScript (Node.js 22 ESM nativo, cero dependencias externas de terceros)** diseñado con **Arquitectura Hexagonal (Puertos y Adaptadores)** para escalar horizontalmente bajo alta concurrencia.

---

## Pilares de Escalabilidad y Diseño

1. **Nodos HTTP Sin Estado (Stateless Horizontal Scaling)**
   - Ninguna sesión de usuario queda anclada en memoria exclusiva de un proceso. Cualquier réplica detrás de un balanceador L7 puede atender cualquier petición.
2. **Persistencia Multinivel (`TieredCartRepository`: L1 + L2)**
   - **L1 (`InMemoryCartRepository` con política LRU + TTL)**: absorbe lecturas repetidas en sub-milisegundos (reemplazable directamente por Redis Cluster).
   - **L2 (`SqliteCartRepository` en modo WAL transaccional)**: fuente de verdad duradera con sentencias Compare-And-Swap (`WHERE id = ? AND version = ?`) e índices parciales sobre carritos activos (mismo patrón SQL que PostgreSQL / CockroachDB).
   - **Invalidación automática de caché**: ante un conflicto de versión detectado en L2 (ej. otro nodo actualizó el carrito), la caché L1 local se invalida de inmediato.
3. **Control de Concurrencia Optimista (OCC) y `ETag` / `If-Match`**
   - Cada mutación incrementa `cart.version` y devuelve `ETag: W/"v<version>"`.
   - Si el cliente envía `If-Match` con una versión obsoleta, el servicio responde `409 Conflict` evitando sobrescrituras silenciosas (*lost updates*) entre pestañas o dispositivos.
   - Si no se fija `If-Match`, el servicio serializa ráfagas intra-proceso por `cartId` y aplica reintentos optimistas con *jitter* frente a colisiones entre nodos.
4. **Idempotencia Extremo a Extremo (`Idempotency-Key`)**
   - Deduplica reintentos de red y peticiones simultáneas en vuelo (*Singleflight*).
   - Verifica el *fingerprint* SHA-256 del cuerpo: reutilizar una misma `Idempotency-Key` con parámetros distintos devuelve `409 IDEMPOTENCY_CONFLICT`.
5. **Aritmética Monetaria Exacta (`Money` en Unidades Menores)**
   - Cálculos de subtotales, descuentos por volumen, cupones porcentuales/fijos, envío e impuestos (puntos básicos) íntegramente en enteros seguros (céntimos/centavos), eliminando errores de coma flotante IEEE 754.
6. **Checkout mediante Saga con Compensación de Inventario**
   - Revalida catálogo y posibles cambios de precio en tiempo real -> reserva stock atómicamente -> transiciona el carrito a `CHECKED_OUT` bajo OCC -> confirma la reserva (o libera el stock automáticamente si la persistencia aborta) -> publica eventos de dominio (`cart.checked_out`).
7. **Carritos de Invitado, Fusión en Login y Expiración TTL**
   - Soporte nativo para sesiones anónimas (`sessionId`) con fusión transaccional (`savePairAtomic`) hacia el carrito del usuario autenticado (`userId`) y purga periódica de carritos abandonados.

---

## Estructura del Proyecto

```text
.
├── package.json
├── tsconfig.json
├── src/
│   ├── domain/                  # Núcleo puro de negocio (sin dependencias de infraestructura)
│   │   ├── cart.ts              # Agregado raíz Cart, límites, fusión y eventos
│   │   ├── money.ts             # Value Object inmutable en céntimos/centavos
│   │   ├── pricing.ts           # Motor de promociones, cupones, impuestos y envío
│   │   ├── events.ts            # Contratos de eventos de dominio
│   │   └── errors.ts            # Jerarquía tipada de errores de negocio
│   ├── application/             # Casos de uso y puertos (interfaces)
│   │   ├── ports.ts             # CartRepository, CatalogInventoryPort, IdempotencyPort, EventBusPort
│   │   └── cart-service.ts      # Orquestación, OCC, idempotencia y Saga de checkout
│   ├── infrastructure/          # Adaptadores intercambiables
│   │   ├── persistence/         # L1 LRU en memoria, L2 SQLite WAL y TieredCartRepository
│   │   ├── catalog/             # Catálogo e inventario con reservas atómicas con TTL
│   │   ├── idempotency/         # Deduplicación Singleflight + huella de payload
│   │   └── events/              # Bus de eventos Pub/Sub en memoria
│   ├── interfaces/http/         # API REST + Consola Web interactiva
│   │   ├── router.ts            # Enrutador HTTP, cabeceras ETag/If-Match e Idempotency-Key
│   │   ├── validation.ts        # Validación de entrada y límite de payload (64 KB)
│   │   └── ui.ts                # Consola visual HTML5/JS servida en GET /
│   └── server.ts                # Composición de dependencias y apagado limpio (graceful shutdown)
└── tests/
    ├── domain.test.ts
    ├── service-concurrency.test.ts
    └── http-api.test.ts
```

---

## Ejecución Rápida

Requisitos: **Node.js >= 22.6** (incluye soporte nativo de TypeScript, `node:test` y `node:sqlite`).

### Ejecutar la batería de tests
```bash
npm test
```

### Iniciar el servidor HTTP (API + Consola Web)
```bash
npm start
```
Abre `http://localhost:3000` en el navegador para usar la consola interactiva, o consume la API REST directamente.

---

## Endpoints Principales de la API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado de salud del nodo |
| `GET` | `/api/v1/products` | Lista productos activos y stock disponible |
| `POST` | `/api/v1/carts` | Crea o recupera carrito activo (`userId` o `sessionId`) |
| `GET` | `/api/v1/carts/:cartId` | Obtiene carrito, desglose de precios y cabecera `ETag` |
| `POST` | `/api/v1/carts/:cartId/items` | Añade unidades de un SKU (`{ sku, quantity }`) |
| `PUT` | `/api/v1/carts/:cartId/items/:sku` | Fija la cantidad exacta de un SKU (`{ quantity }`) |
| `DELETE` | `/api/v1/carts/:cartId/items/:sku` | Elimina un artículo del carrito |
| `DELETE` | `/api/v1/carts/:cartId/items` | Vacía el carrito |
| `POST` | `/api/v1/carts/:cartId/coupons` | Aplica un cupón (`BIENVENIDA10`, `AHORRA25`, `VIP15`) |
| `DELETE` | `/api/v1/carts/:cartId/coupons` | Elimina el cupón aplicado |
| `POST` | `/api/v1/carts/merge` | Fusiona un carrito de invitado en el carrito del usuario (`{ guestCartId, userId }`) |
| `POST` | `/api/v1/carts/:cartId/checkout` | Reserva stock, cierra el carrito y emite la orden |
| `GET` | `/api/v1/events` | Consulta los últimos eventos de dominio publicados |

### Ejemplo rápido con `curl`

```bash
# 1. Crear carrito de invitado
curl -i -X POST http://localhost:3000/api/v1/carts \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_demo_1"}'

# 2. Añadir producto usando Idempotency-Key e If-Match
curl -i -X POST http://localhost:3000/api/v1/carts/<CART_ID>/items \
  -H "Content-Type: application/json" \
  -H "If-Match: W/\"v1\"" \
  -H "Idempotency-Key: req-001" \
  -d '{"sku":"LAPTOP-PRO-14","quantity":1}'
```
