# CCA · ollama/inkling-2-small · 9/10

**Bien diseñado, sin Redis.** API Fastify sin estado en TypeScript, con capas y puertos, dinero en céntimos, precio del catálogo, cupones, IVA, envío, caducidad de carritos y compare-and-set por versión en el repositorio. Compila, pasa 21 tests y 50 altas a la vez no pierden nada. Pero solo trae repositorios en memoria: Redis o Postgres quedan como «pendiente».

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se ejecuta | 1 |
| tests en verde | 1 |
| dominio completo | 1 |
| dinero exacto | 1 |
| precio del catálogo y validación | 1 |
| concurrencia | 2 |
| escala horizontal | 1 |
| explica el escalado | 1 |
| **Total** | **9** |

## Lo que entregó
- Node + TypeScript + Fastify + Zod: dominio (`Cart`, motor de precios, errores y eventos), servicio con puertos (`CartRepository`, `ProductCatalog`, `CouponRepository`, `EventBus`), adaptadores en memoria, API REST `/api/v1` y 21 tests con Vitest.

## Validación (en una copia; `juez/` es mío)
- `npm ci`, `build` y `vitest`: 21/21.
- Servidor real, 50 altas a la vez: 50 respuestas 200 y 50 unidades guardadas.
- El precio que manda el cliente se ignora: el total sale de `priceCents` del catálogo.
- Carrito inexistente → `404 CART_NOT_FOUND` con JSON claro.

## Lo que falta
- Un almacenamiento compartido de verdad: con dos instancias, cada una tendría sus carritos.
- Tests de carga (lo dice él).

## Rarezas de la sesión
- Preguntó con la herramienta de preguntas (stack: Node/TS, Python/FastAPI o Java/Spring; alcance) y el lanzador le contestó «Decide tú.». Eligió lo que marcaba como recomendado.
- Hizo un smoke test del flujo completo (crear, añadir, cupón, checkout) contra el servidor.
- 40 peticiones y 1 millón de tokens.
