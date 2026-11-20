# CCA · claude-sonnet-5-5 (Claude Code, esfuerzo medio) · 9/10

**Escala en 400 líneas.** Poco código y el que hace falta: servicio sin estado, versión optimista y un Redis que funciona de verdad. Lo que falla es lo más básico: el carrito que devuelve no está protegido.

> Repetición. El primer intento se cortó por el diálogo de recomendación del plugin `pyright-lsp` y está en `_descartados/`.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se ejecuta | 1 |
| tests en verde | 1 |
| dominio completo | 1 |
| dinero exacto | 1 |
| precio del catálogo y validación | 0 |
| concurrencia | 2 |
| escala horizontal | 2 |
| explica el escalado | 1 |
| **Total** | **9** |

## Lo que entregó
Python 3 sin dependencias: dominio con dataclasses congeladas y dinero en céntimos (`domain.py`), puerto de repositorio con un adaptador en memoria con TTL y otro de Redis con compare-and-swap en un script Lua (`repository.py`), servicio con reintentos (`service.py`), API JSON con `http.server` (`api.py`), 8 tests con `unittest` y un README corto con las decisiones de escalado.

## Validación (en una copia; `juez/juez.py` es mío, las mismas pruebas que a los demás)
- `python3 tests/test_cart.py`: 8/8. `python3 -m cart.api` arranca y con curl se añade, se cambia la cantidad, se quita y se vacía.
- **Concurrencia en memoria**: 50 altas a la vez, por el servicio o por HTTP, entran las 50.
- **Redis real** (redis-server local y `redis-py` en un venv en `/tmp`, montado a mano porque `api.py` solo arranca con memoria): con dos instancias HTTP sobre el mismo Redis, 50 POST a la vez dan 47 × 200 y 3 × 409, y quedan 47 líneas con versión 47. Nada se pierde ni se duplica. Un `DELETE` en una instancia lo ve la otra; las claves llevan TTL de 7 días y hash tag para Cluster.
- **Dinero**: 0,10 × 3 = 30 céntimos. El precio que manda el cliente se ignora.
- **Moneda**: no hay nada que mezclar; el catálogo solo da `price_cents` y el carrito es siempre EUR.
- **Id `../fuera`**: la ruta HTTP lo rechaza (404), pero el servicio lo acepta y lo guarda tal cual.
- **Objeto devuelto**: `Cart` es una dataclass congelada, pero `items` es un `dict` compartido con el almacén. `c.items["a"] = CartItem("a", 500, 1)` deja en memoria 500 unidades a 1 céntimo sin pasar por el catálogo ni por el límite de 999.

## Lo que está bien
- El CAS en Lua compara y escribe datos y versión de una vez: varias réplicas pueden escribir sin locks distribuidos, y funciona.
- Validación de cantidades estricta: rechaza 0, negativos, decimales, `True`, cadenas y 1e9.
- TTL para carritos abandonados en los dos adaptadores, con reloj inyectable y test.
- Dice en la respuesta lo que no ha probado y lo que deja fuera (idempotencia, fusión de carritos, reserva de stock).

## Lo que falta o está mal
- **El carrito devuelto se puede mutar** y en el repositorio en memoria eso cambia lo guardado: se salta el precio del catálogo y los límites. En Redis no pasa porque se serializa.
- Una sola moneda fija; el catálogo no tiene moneda.
- El servicio no valida el id del carrito; solo lo hace la expresión regular de la ruta HTTP.
- Redis no está conectado en `api.py` ni exportado en `cart/__init__.py`, y no tiene tests.
- Reintentos inmediatos, sin espera: con contención, entre 2 y 6 de 50 acaban en 409.
- El servidor es `ThreadingHTTPServer` de la librería estándar; con 50 conexiones a la vez llegó a resetear alguna por la cola de escucha.

## Rarezas de la sesión
- **3 peticiones, 124 k tokens, 72 s y 0,16 $.** Todo el código en un solo heredoc, tests en verde a la primera y sin tocarlos.
- Lo que dice que no ha probado (Redis y la API) es justo lo que mejor sale en las pruebas del juez.
- El test de concurrencia que cita lanza 6 hilos.
- Al acabar, Claude Code dejó en la caja de entrada su sugerencia «añade la idempotencia con Idempotency-Key». No se envió: la sesión tiene un solo mensaje.
- Sin encierro: `scripts/fugas.py` no encuentra lecturas fuera de `/var/tmp/bench/ws-5gnn47QN`.
- Dejó `__pycache__` en la entrega.
