Se ha implementado un **Carrito de la Compra Escalable** en la carpeta actual utilizando **TypeScript sobre Node.js 22 nativo** (ESM, `node:sqlite` en modo WAL y `node:test`, sin dependencias externas que instalar) bajo una **Arquitectura Hexagonal (Puertos y Adaptadores)** lista para escalar horizontalmente.

### Características implementadas

- **Dominio puro y exactitud monetaria (`src/domain/`)**:
  - `src/domain/money.ts`: Value Object `Money` en unidades menores enteras (céntimos/centavos) y puntos básicos para evitar errores de coma flotante IEEE 754 e impedir mezcla de divisas.
  - `src/domain/pricing.ts`: Motor extensible de promociones (descuento automático por volumen, cupones porcentuales/fijos con importe mínimo y tope máximo, umbral de envío gratuito e cálculo de IVA).
  - `src/domain/cart.ts`: Agregado raíz `Cart` con límites por carrito/SKU, soporte de carritos anónimos (`sessionId`) y de usuario (`userId`), fusión de carritos en login, expiración TTL y emisión de eventos de dominio.

- **Escalabilidad, Concurrencia e Idempotencia (`src/application/` y `src/infrastructure/`)**:
  - **Persistencia multinivel Read/Write-Through** (`src/infrastructure/persistence/tiered-cart-repository.ts`): combina caché rápida **L1 LRU** en memoria (`in-memory-cart-repository.ts`) con almacenamiento transaccional **L2 SQLite WAL** (`sqlite-cart-repository.ts`), invalidando automáticamente L1 ante conflictos detectados en L2.
  - **Control de Concurrencia Optimista (CAS / `ETag` + `If-Match`)**: validación atómica `WHERE id = ? AND version = ?`, serialización asíncrona ligera por `cartId` intra-nodo y reintentos con *jitter* entre nodos (`src/application/cart-service.ts`).
  - **Idempotencia (`Idempotency-Key`)**: deduplicación *Singleflight* de peticiones en vuelo y verificación de huella SHA-256 del cuerpo (`src/infrastructure/idempotency/in-memory-idempotency-store.ts`).
  - **Checkout con Saga y compensación de stock**: revalidación de precios vigentes en catálogo, reserva atómica de inventario con TTL y liberación compensatoria automática si la confirmación falla (`src/infrastructure/catalog/in-memory-catalog-inventory.ts`).

- **API HTTP REST + Consola Web Interactiva (`src/interfaces/http/` y `src/server.ts`)**:
  - Endpoints REST completos (`/api/v1/carts`, `/items`, `/coupons`, `/merge`, `/checkout`, `/api/v1/products`, `/api/v1/events`, `/health`).
  - Interfaz web interactiva servida directamente en `GET /` para probar el catálogo, cupones, fusión de usuario y checkout desde el navegador.

### Comandos disponibles

- Ejecutar los tests automatizados (dominio, concurrencia/caché/idempotencia y API HTTP end-to-end):
  ```bash
  npm test
  ```
- Levantar el servidor HTTP (por defecto en `http://localhost:3000`):
  ```bash
  npm start
  ```

Consulta `README.md` para ver el detalle completo de rutas y ejemplos con `curl`.
