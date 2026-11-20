# CCA · google/gemini-4-carbon · 9/10

**Escala en una máquina.** Concurrencia optimista sobre SQLite que funciona entre dos instancias, pero cada una guarda su caché, su stock y su idempotencia.

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

## Validación
- En una copia: sin nada que instalar (TypeScript nativo de Node 22, `node:sqlite`, `node:test`). `npm test`: 9/9. `npm start` levanta la API y una consola web en `/`.
- `juez/juez.mjs`, con dos instancias que comparten `CART_DB_PATH`:
  - 50 altas a la vez de un SKU con stock 120: 50 guardadas, tanto en una instancia como repartidas entre dos.
  - Con el primer SKU (stock 25) acepta 25 y rechaza 25 con `INSUFFICIENT_STOCK`.
  - El precio mandado por el cliente se ignora: guarda 119,50 € del catálogo.
  - Cantidad 0, negativa o decimal → 400; mil millones → 409; sku inexistente o con `../` → 404; cartId con `../` → 404; cuerpo vacío → 400.
  - `Money`: 0,10 × 3 = 30 céntimos; sumar EUR y USD da error. La vista devuelta es una copia: mutarla no cambia el carrito.
- `juez/cache-l1.mjs`: cuando la instancia A escribe, la B sigue leyendo la versión anterior desde su caché L1. Si B escribe sobre su copia vieja, el compare-and-set de SQLite lo detecta, reintenta y guarda bien. Las escrituras son correctas; las lecturas, no.

## Lo que está bien
- Dominio completo y bien separado: añadir, fijar cantidad, quitar, vaciar, cupones con mínimo y tope, descuento por volumen, envío gratis, IVA en puntos básicos, fusión del carrito de invitado al iniciar sesión, caducidad.
- Concurrencia de verdad: cerrojo por carrito dentro del proceso y `UPDATE … WHERE version = ?` con reintentos entre procesos; `ETag` / `If-Match` para el cliente; `Idempotency-Key` con huella del cuerpo.
- Checkout como saga: revalida precios, reserva stock y lo libera si falla la confirmación.
- README claro sobre cada decisión de escalado.

## Lo que falta o está mal
- No es «sin estado», como dice el README: la caché L1 de cada nodo no se invalida cuando escribe otro y sirve datos viejos.
- Stock, reservas, idempotencia y eventos viven en memoria de cada proceso: con dos instancias se puede vender el mismo stock dos veces y una clave de idempotencia solo vale en el nodo que la vio.
- El almacenamiento compartido es un fichero SQLite: sirve para varios procesos en una máquina, no para varias máquinas. Redis o Postgres solo aparecen en comentarios.

## Rarezas de la sesión
- Preguntó con la herramienta de preguntas qué tipo de solución hacía (API, full-stack, módulo); el lanzador la cerró y siguió con la opción que marcaba como recomendada.
- Antes de elegir, miró qué traía la máquina (node, npm, python, go, la versión de SQLite de Node) y se quedó con Node 22 a pelo: cero dependencias.
- El primer `npm test` dio 8/9; arregló el servicio, no el test.
- 25 peticiones, 835 000 tokens (694 000 de caché), 0,72 $.
