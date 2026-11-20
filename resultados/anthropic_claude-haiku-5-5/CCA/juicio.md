# CCA · claude-haiku-5-5 (Claude Code) · 9/10

**Escala de verdad.** Es la respuesta que daría alguien que sabe qué se rompe cuando un carrito tiene tráfico, y lo deja escrito en el código y en el README.

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
JavaScript con módulos ES, sin dependencias, 991 líneas: dominio puro e inmutable (`cart.js`), dinero en céntimos (`money.js`), motor de precios con reglas encadenables e impuestos (`pricing.js`), repositorio versionado (`repository.js`), catálogo por lotes, bus de eventos, servicio que lo orquesta, 30 tests con `node:test`, un ejemplo y un README con las decisiones de escalado.

## Validación (en una copia; `juez/juez.mjs` es mío, las mismas pruebas que al de nemotron)
- `npm test` 30/30 y `npm run example` correctos.
- **Concurrencia**: 50 altas a la vez sobre el mismo carrito no pierden ninguna. Con los 5 reintentos por defecto, 6 entran y 44 devuelven `CONCURRENCY_CONFLICT`: error explícito, no datos perdidos. Con 100 reintentos entran las 50.
- **Moneda**: un producto en USD en un carrito EUR → `CURRENCY_MISMATCH`.
- **Dinero**: 0,10 × 3 = 30 céntimos exactos.
- **Id `../fuera`** → `INVALID_CART_ID` (patrón `[A-Za-z0-9_-]{1,128}`).
- El carrito que devuelve está congelado: tocarlo fuera no cambia nada.

## Lo que está bien
- Concurrencia optimista explicada con su equivalente SQL (`UPDATE … WHERE version = $3`).
- El precio sale del catálogo, nunca del cliente; el README avisa de que el checkout debe revalidarlo.
- Los totales se calculan al leer: las promociones cambian sin migrar datos.
- Límites de líneas y de cantidad para acotar el tamaño de cada documento.

## Lo que falta
- **Solo repositorio en memoria**: Redis, PostgreSQL o DynamoDB quedan como contrato. Lo dice.
- Reintentos inmediatos, sin espera ni jitter: con mucha contención se pisan, como se ve en la prueba.
- Sin caducidad de carritos abandonados.
- Los eventos se emiten en el proceso tras guardar: si el proceso cae entre una cosa y otra se pierden (no hay outbox).

## Rarezas de la sesión
- Tocó tres tests y lo explica en los tres: dos cuentas mal hechas en sus expectativas (se olvidaba del pan en el subtotal; 20 escrituras desde versión 0 dan 20, no 21) y el límite de reintentos del test de concurrencia (subido a 30, y lo cuenta en la respuesta final).
- Calcula el ejemplo a mano en el chat y cuadra.
- 11 peticiones, pero 636 k tokens: el que más ha gastado de todo el benchmark. El 88 % es lectura de caché.
- Comentarios, README y respuesta en español; identificadores en inglés.
