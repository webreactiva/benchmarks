Se ha implementado un **carrito de la compra escalable** en TypeScript (sin dependencias externas) siguiendo **Arquitectura Hexagonal (Puertos y Adaptadores)** y **Domain-Driven Design (DDD)** en la carpeta actual (`/var/tmp/bench/ws-9umG32ZD`).

### Archivos generados

- **Configuración y documentación**
  - `package.json`, `tsconfig.json`, `README.md`
- **Núcleo de dominio (`src/domain/`)**
  - `src/domain/money.ts`: Value Object `Money` inmutable basado en unidades mínimas enteras (céntimos) con validación de divisa ISO-4217.
  - `src/domain/cart-item.ts`: Entidad `CartItem` con soporte para variantes (`productId::variantId`), categoría fiscal, peso y límites de cantidad.
  - `src/domain/cart.ts`: Aggregate Root `Cart` con control de concurrencia optimista (`version`), TTL/expiración, fusión de carritos (`mergeFrom`), serialización (`toSnapshot`/`fromSnapshot`) y eventos de dominio.
  - `src/domain/events.ts`, `src/domain/errors.ts`: Eventos y errores tipados de dominio.
- **Motor de promociones y precios (`src/promotions/`, `src/pricing/`)**
  - `src/promotions/promotion.ts`: `PromotionRegistry` con reglas extensibles (`PercentageDiscountRule`, `FixedAmountDiscountRule`, `BuyXGetYRule`, `TieredVolumeDiscountRule`) y soporte para promociones exclusivas vs. acumulables.
  - `src/pricing/tax-strategy.ts`: Estrategias de impuestos (`CategoryTaxStrategy`, `ZeroTaxStrategy`).
  - `src/pricing/shipping-strategy.ts`: Estrategias de envío (`FreeThresholdShippingStrategy`, `WeightBasedShippingStrategy`).
  - `src/pricing/pricing-engine.ts`: Pipeline determinista `PricingEngine` (subtotal bruto → descuentos prorrateados → impuestos → envío → total final).
- **Puertos, adaptadores y servicio de aplicación (`src/ports/`, `src/infrastructure/`, `src/application/`)**
  - `src/ports/repositories.ts`: Interfaces desacopladas (`CartRepository`, `CatalogPort`, `InventoryPort`, `EventBusPort`, `IdempotencyStore`).
  - `src/infrastructure/in-memory-adapters.ts`: Adaptadores en memoria con snapshots inmutables y bloqueo optimista (`InMemoryCartRepository`, `InMemoryCatalogAdapter`, `InMemoryInventoryAdapter`, `InMemoryEventBus`, `InMemoryIdempotencyStore`).
  - `src/application/cart-service.ts`: `CartService` con casos de uso (`createCart`, `addItem`, `updateItemQuantity`, `removeItem`, `applyCoupon`, `mergeGuestCart`, `checkout`), reintentos automáticos ante conflictos de concurrencia, claves de idempotencia y compensación tipo Saga si falla el guardado durante el `checkout`.
  - `src/index.ts`: Exportaciones públicas (compilado en `dist/`).
- **Pruebas y ejemplo (`tests/`, `examples/`)**
  - `tests/money.test.mjs`, `tests/cart-domain.test.mjs`, `tests/promotions-pricing.test.mjs`, `tests/cart-service.test.mjs`
  - `examples/demo.mjs`

### Verificación ejecutada

- `npm run typecheck`: compilación estricta de TypeScript sin errores.
- `npm test`: **14/14 tests aprobados** (`tsc && node --test tests/*.test.mjs`).
- `node examples/demo.mjs`: ejecución completa de flujo invitado → fusión con usuario → promociones 3x2 + cupón → impuestos → checkout atómico (`203.48 EUR`).
