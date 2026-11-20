# Carrito de la Compra Escalable (TypeScript)

Implementación modular y sin dependencias externas de un sistema de carrito de la compra diseñado con **Arquitectura Hexagonal (Puertos y Adaptadores)**, **Domain-Driven Design (DDD)** y patrones preparados para escalar horizontalmente en producción.

## Estructura del proyecto

```text
src/
├── domain/
│   ├── errors.ts          # Errores tipados de dominio
│   ├── money.ts           # Value Object inmutable en unidades mínimas (céntimos)
│   ├── events.ts          # Eventos de dominio (CartCreated, CartItemAdded, CartCheckedOut, ...)
│   ├── cart-item.ts       # Entidad de línea con soporte de variantes y categoría fiscal
│   └── cart.ts            # Aggregate Root con versión optimista, TTL y fusión de carritos
├── promotions/
│   └── promotion.ts       # Motor extensible de promociones (%, importe fijo, XxY, volumen)
├── pricing/
│   ├── tax-strategy.ts    # Estrategia de impuestos por categoría (IVA estándar/reducido/etc.)
│   ├── shipping-strategy.ts # Estrategia de envío (tarifa plana con umbral gratis o por peso)
│   └── pricing-engine.ts  # Pipeline determinista de cálculo de totales
├── ports/
│   └── repositories.ts    # Contratos desacoplados (CartRepository, Catalog, Inventory, EventBus, Idempotency)
├── infrastructure/
│   └── in-memory-adapters.ts # Adaptadores en memoria con snapshots inmutables
├── application/
│   └── cart-service.ts    # Casos de uso, reintentos de concurrencia, merge invitado y checkout Saga
└── index.ts               # Exportaciones públicas
```

## Decisiones de escalabilidad

1. **Concurrencia optimista (`version`)**: Cada mutación incrementa `version`. El repositorio valida la versión esperada (`save(cart, expectedVersion)`), evitando pérdidas de datos bajo múltiples réplicas. `CartService` reintenta automáticamente conflictos transitorios o respeta versiones explícitas (`If-Match`).
2. **Idempotencia en operaciones críticas**: `createCart`, `addItem` y `checkout` aceptan `idempotencyKey` para tolerar reintentos de red sin duplicar ítems ni cobros.
3. **Precisión monetaria (`Money`)**: Almacena importes en enteros menores (céntimos) y valida compatibilidad de divisa ISO-4217.
4. **Checkout atómico con compensación tipo Saga**: Reserva stock antes de confirmar el estado `CHECKED_OUT`; si falla la persistencia del carrito, libera automáticamente el inventario reservado.
5. **Fusión invitado → usuario (`mergeGuestCart`)**: Transfiere ítems y cupones del carrito anónimo al del usuario autenticado validando stock y límites.
6. **Cero acoplamiento a infraestructura**: Sustituir `InMemoryCartRepository` por Redis o PostgreSQL (JSONB + `WHERE version = $expected`) solo requiere implementar la interfaz `CartRepository`.
7. **Extensibilidad de precios y promociones**: Nuevas reglas de descuento, impuestos regionales o transportistas se añaden implementando `PromotionRule`, `TaxStrategy` o `ShippingStrategy` sin modificar el núcleo.

## Comandos

```bash
# Compilar TypeScript
npm run build

# Compilar y ejecutar todos los tests (Node native test runner)
npm test

# Ejecutar demostración de extremo a extremo
npm run demo
```
