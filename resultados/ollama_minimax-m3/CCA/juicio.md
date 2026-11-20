# CCA · ollama/minimax-m3 · 10/10

**Escala de verdad, con Redis.** Es lo que haría un equipo con tiempo: arquitectura limpia, almacenamiento compartido real, y comprobado.

> Repetición con la regla «Decide tú.». La primera prueba, en la que preguntó qué stack usar y no se le contestó, está en `_descartados/`. En esta no llegó a preguntar.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se ejecuta | 1 |
| tests en verde | 1 |
| dominio completo | 1 |
| dinero exacto | 1 |
| precio del catálogo y validación | 1 |
| concurrencia | 2 |
| escala horizontal | 2 |
| explica el escalado | 1 |
| **Total** | **10** |

## Lo que entregó
Un monorepo con tres paquetes: `core` (dominio sin dependencias, `Money` en céntimos, motor de precios, puertos), `server` (Fastify sin estado, adaptadores de Redis con scripts Lua, idempotencia por `Idempotency-Key`, outbox y pub/sub, rate limiting, `/health`, `/metrics`, SSE) y `client` (tienda en React + Vite). Con Docker Compose, ESLint, Prettier y un README con las decisiones.

## Validación (en una copia; `juez/` es mío)
- `npm ci`, `build`, `typecheck` y `lint` en verde; `vitest`: 69/69, también los de integración contra un Redis local.
- **Dos instancias del servidor sobre el mismo Redis**, 40 altas a la vez repartidas entre ellas: 22 aceptadas, 18 con `409` (conflicto) y **22 unidades guardadas**. Nada se pierde ni se duplica.
- 50 altas del mismo producto: 10 aceptadas y 40 con `422 CART_LIMIT_EXCEEDED` (máximo 10 por línea). El subtotal sale del precio del catálogo (10 × 12,90 €).

## Lo que se le puede discutir
- Bajo mucha contención devuelve `409` en lugar de reintentar más veces; el cliente tiene que repetir. Es una decisión válida, pero el README promete «se relee y se reaplica».
- La identidad del cliente es una cabecera `x-customer-id` (lo avisa como sustituto de un JWT).

## Rarezas de la sesión
- **155 peticiones y 12,9 millones de tokens**, el mayor gasto del benchmark en una sola prueba.
- Esta vez no preguntó: decidió solo y eligió lo que en la primera tirada proponía como «recomendado».
- Encontró el `redis-server` del sistema y lo usó para probar de verdad.
- Dejó `node_modules` (210 MB) y las carpetas `dist` en la entrega.
