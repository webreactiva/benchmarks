# CCA · claude-opus-5-5 (Claude Code, esfuerzo medio) · 10/10

**Escala, y Redis funciona.** Servicio sin estado, versión optimista y un Redis que se conecta con una variable de entorno y no pierde nada con dos instancias. Lo que falla es de detalle: la moneda y las piezas que solo viven en memoria.

> Repetición. El primer intento se cortó por un diálogo de permisos del arnés y está en `_descartados/`; no cuenta para la nota.

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
Node 20+ con módulos ES y sin dependencias en modo memoria: dominio con funciones puras que devuelven un carrito nuevo, dinero en céntimos y motor de precios con reglas registrables (porcentaje, importe fijo, 3x2, envío gratis, IVA); servicio con reintentos y backoff con jitter; repositorio en memoria (serializado, con TTL) y de Redis (hash por carrito, CAS en Lua, TTL, hash tag para Cluster); API REST con `node:http`, `ETag`/`If-Match`, `Idempotency-Key`, fusión de carritos, modo `CLUSTER` y apagado ordenado. 19 tests y un README con una tabla de decisiones de escalado. Unas 1300 líneas.

## Validación (en una copia; `juez/juez.mjs` es mío, las mismas pruebas que a los demás)
- `npm test`: 19/19 en tres pasadas. `npm start` arranca y por HTTP se añade, se cambia la cantidad, se quita y se vacía.
- **Concurrencia en memoria**: 50 altas a la vez, por el servicio o por HTTP, mismo producto o 50 distintos: entran las 50.
- **Redis real** (redis-server local en el puerto 6390 e `ioredis` instalado en la copia): con dos servicios sobre el mismo Redis, entre 44 y 48 de 50 se aceptan y todas las aceptadas están guardadas; el resto acaba en `VERSION_CONFLICT`. Con dos instancias HTTP (`REDIS_URL`, sin tocar código) 50 POST dan 49 × 200 y 1 × 409, y quedan 49 unidades con versión 50. Con `CLUSTER=1` y dos workers, lo mismo. Un alta en una instancia la ve la otra, un `DELETE` también; TTL de 30 días.
- **Dinero**: 0,10 × 3 = 30 céntimos. El precio que manda el cliente se ignora.
- **Moneda**: el catálogo no tiene moneda y el cliente elige la del carrito al crearlo sin validación: un carrito `USD` cobra los precios pensados en euros y `{"x":1}` se guarda tal cual. No se mezclan monedas dentro de un carrito porque no hay de dónde.
- **Id `../fuera`**: no se puede crear; el id lo genera el servicio con UUID. Consultarlo da `NOT_FOUND` y por HTTP, 404.
- **Objeto devuelto**: la vista se construye nueva en cada llamada y el repositorio guarda JSON. Poner 500 unidades a 1 céntimo en lo devuelto (y en lo que da `repo.get`) no cambia nada guardado.

## Lo que está bien
- El CAS en Lua compara versión y escribe datos y TTL de una vez, y está conectado: `REDIS_URL` basta para tener varias réplicas.
- Encontró y arregló una condición de carrera real en su propio repositorio en memoria (un `await` entre comprobar y escribir).
- Validación estricta: cantidades no enteras, booleanos, cadenas, negativos, más de 99 por línea, más de 100 líneas, SKU con `/`, cuerpo de más de 16 KB.
- Al ver el carrito repreciona con el catálogo y avisa de precio cambiado, producto retirado, stock insuficiente o cupón caducado.
- El README dice qué está probado y qué no, y qué piezas no valen para varias réplicas.

## Lo que falta o está mal
- La moneda del carrito la elige el cliente y no se valida; el catálogo no tiene moneda.
- `ioredis` no está en `package.json`; hay que instalarlo a mano.
- Idempotencia, catálogo, cupones y bus de eventos solo en memoria: con varias réplicas la `Idempotency-Key` no protege.
- Con 5 reintentos, bajo contención entre el 2 y el 12 % de las altas acaban en 409. Es explícito, no se pierde nada.
- No hay test contra un Redis real; solo un cliente simulado.

## Rarezas de la sesión
- **13 peticiones, 726 k tokens (650 k de caché), 4 min 25 s.** Fichero a fichero, tests y una prueba con curl.
- Su test de concurrencia falló (cantidad 1 de 50) y lo arregló en el código, no en el test. Lo único que tocó para que corrieran fue el glob de `npm test`.
- Lo que dice que no ha probado (Redis contra un servidor real) es justo lo que mejor sale en las pruebas del juez.
- Sin encierro: `scripts/fugas.py` no encuentra lecturas fuera de `/var/tmp/bench/ws-FvdIqxPx`, pero escribió el log del servidor en `/tmp/claude-0/srv.log` y lo paró con `pkill -f "node src/index.js"`, que mata cualquier proceso con ese nombre en la máquina.
- Al acabar, Claude Code dejó en la caja de entrada la sugerencia «Implementa la idempotencia con Redis para varias réplicas». No se envió: la sesión tiene un solo mensaje.
