# CCA · google/gemini-4-neon · 6/10

**Sólido pero sin terminar.** El dominio, el dinero y la validación están al nivel de los mejores, pero la sesión se cortó antes de los tests y del README, y la concurrencia solo aguanta dentro de un proceso.

Se juzga tal cual quedó, por decisión del autor: OpenRouter rechazó la petición 13 con un 402 por falta de saldo (límite nuestro) y la sesión no llegó a dar su respuesta final.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se ejecuta | 1 |
| tests en verde | 0 |
| dominio completo | 1 |
| dinero exacto | 1 |
| precio del catálogo y validación | 1 |
| concurrencia | 1 |
| escala horizontal | 1 |
| explica el escalado | 0 |
| **Total** | **6** |

## Validación
- En una copia: `node src/demo.ts` funciona (Node ≥ 22.18 carga los `.ts` sin compilar). Crea un carrito de invitado y otro de usuario, los fusiona, aplica `WELCOME10`, hace checkout, repite el checkout con la misma clave de idempotencia (mismo `orderId`) y descuenta stock.
- `npm test` pasa con 0 tests: `tests/` no existe.
- `tsc --noEmit` da 9 errores, todos por `structuredClone`, que falta en sus declaraciones de Node.
- `juez/juez.mjs`, montado con su `createDefaultCartSystem`:
  - 50 `addItem` a la vez sobre el mismo carrito: las 50 se guardan.
  - El precio que manda el cliente se ignora.
  - Cantidad 0, negativa o decimal → `VALIDATION_ERROR`; mil millones → `INSUFFICIENT_STOCK`.
  - Producto o carrito con `../` → no encontrado.
  - 0,10 × 3 = 30 céntimos; EUR + USD → `CURRENCY_MISMATCH`; un producto en EUR en un carrito en USD, también.
  - Mutar el carrito devuelto no cambia lo guardado.
  - Dos instancias del servicio sobre el mismo `FileCartRepository`, 20 altas alternas: las 20 dicen que sí y se guardan 10.

## Lo que está bien
- Dominio completo: añadir, cambiar cantidad, quitar, vaciar, cupones, promociones (3x2, volumen, porcentaje con tope, importe fijo, envío gratis), IVA por región, envío por umbral, fusión de invitado a usuario, caducidad y checkout con reserva de stock.
- Dinero en céntimos enteros con moneda ISO comprobada en cada operación; precio siempre del catálogo, que se refresca al leer.
- Puertos para repositorio, catálogo, inventario, eventos, idempotencia y cerrojos; el servicio no guarda estado propio del carrito, y el repositorio exige `expectedVersion` en cada `save`.
- API HTTP sin dependencias con límite de cuerpo, `If-Match` para la versión y errores mapeados a códigos.

## Lo que falta o está mal
- Sin tests y sin README: no explica sus decisiones de escalado más allá de los comentarios de los puertos («Redis / Redlock / Postgres»).
- La versión optimista del `FileCartRepository` se comprueba dentro de una cola de escrituras del propio proceso. Dos instancias leen la misma versión, las dos escriben y una pisa a la otra sin `CONCURRENCY_CONFLICT`. El único almacenamiento compartido que trae no aguanta varias réplicas, y los cerrojos y la idempotencia solo existen en memoria.
- No compila con `tsc` en modo estricto, aunque corre.

## Rarezas de la sesión
- Escribió 27 ficheros y 3700 líneas sin ejecutar nada: los cuatro comandos de shell solo miraron versiones de node y tsc y los paquetes globales.
- En lugar de instalar `@types/node`, escribió sus propias declaraciones de Node (`src/types/node.d.ts`) y se dejó `structuredClone`.
- `package.json` promete `tests/*.test.ts` y la carpeta nunca llegó.
- 12 peticiones, 213 000 tokens, 0,75 $.
