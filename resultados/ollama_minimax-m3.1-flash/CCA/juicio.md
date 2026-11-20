# CCA · ollama/minimax-m3.1-flash · 10/10

**El carrito más completo del benchmark.** API Fastify sin estado con todo el carrito en Redis y cada mutación atómica en un script Lua, más concurrencia optimista por versión, idempotencia, outbox con worker y grupo de consumidores, rate limiting distribuido, JWT, métricas, Docker Compose para escalar réplicas y una prueba de carga con k6. Compila, pasa 42 tests y, con dos instancias, 40 altas a la vez entran todas sin un conflicto.

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

## Validación (en una copia; `juez/` es mío)
- `npm ci`, `build`, `typecheck` y `lint` en verde; `vitest`: 42/42 (los de integración arrancan su propio Redis).
- Dos instancias sobre el mismo Redis, 40 altas a la vez repartidas entre las dos: 40 aceptadas y 40 unidades guardadas. A diferencia de los carritos con versión optimista, ni siquiera hay 409: el script Lua hace la operación de una vez.
- Sin token: 401. El precio que manda el cliente se ignora.

## Lo que está bien
- Outbox transaccional: el evento se escribe en el mismo script Lua que la mutación, y un worker lo consume con `XAUTOCLAIM`.
- Degradación si cae Redis, caché LRU para lecturas, `/healthz`, `/readyz`, `/metrics`.
- README con las decisiones y los dos fallos que encontró (ioredis no aplica `keyPrefix` a `XGROUP`; el timeout cortaba `XREADGROUP`).

## Lo que se puede discutir
- Para un «carrito escalable» es mucho: JWT, rate limiting, merge de carritos, worker. Pero todo funciona.

## Rarezas de la sesión
- 154 peticiones y 14,6 millones de tokens: el mayor gasto de todo el benchmark en una sola prueba.
- Encontró y corrigió dos fallos reales de ioredis con streams, y los dejó documentados con tests.
- Dejó dist/ y node_modules/ en la entrega.
