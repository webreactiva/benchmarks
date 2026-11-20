# CCA · ollama/glm-5.3-flash · 8/10

**Bien diseñado, Redis roto.** La arquitectura es de las mejores del benchmark, pero el adaptador que la hace escalar falla en cuanto algo va mal.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se ejecuta | 1 |
| tests en verde | 1 |
| dominio completo | 1 |
| dinero exacto | 1 |
| precio del catálogo y validación | 1 |
| concurrencia | 1 |
| escala horizontal | 1 |
| explica el escalado | 1 |
| **Total** | **8** |

## Lo que entregó
Python, 908 líneas en `cart/`: dominio puro (`Product`, `CartItem`, `Cart` con versión), casos de uso, puertos, repositorios en memoria con bloqueo por carrito, adaptador de Redis con `WATCH`/`MULTI`, API REST sin estado con `ThreadingHTTPServer`, eventos de dominio, 24 tests, README y `pyproject.toml`.

## Validación (en una copia; `juez/` es mío)
- `pytest`: 24/24.
- 50 hilos añadiendo a la vez en memoria: 50 líneas, ninguna perdida.
- `Decimal`: 0,10 × 3 = 0.30. Precio negativo rechazado. El snapshot devuelto no cambia el carrito.
- **Redis con `fakeredis`**: `update` sobre un carrito que no existe da `AttributeError: 'FakeRedis' object has no attribute 'WatchError'`. El `except self._client.WatchError` se evalúa al saltar cualquier excepción, y un cliente de redis-py no tiene ese atributo (es `redis.exceptions.WatchError`). Resultado: el reintento optimista nunca se ejecuta y los errores de negocio salen como 500.

## Lo que está bien
- Capas limpias y puertos intercambiables; API sin estado detrás de balanceador.
- Dinero en `Decimal`, precio del catálogo y no del cliente, límites de líneas y de cantidad, estado de checkout.
- Probó el servidor de verdad con curl.

## Lo que falla
- **El adaptador de Redis** (arriba). Y su bucle `while True` no tiene límite de reintentos.
- Sin caducidad de carritos (ni `EXPIRE` en Redis).
- Volver a añadir un producto que ya está da error en vez de sumar.
- Sin moneda: asume una sola.

## Rarezas de la sesión
- 33 peticiones y 1,08 millones de tokens, con varias vueltas de tests rojos a verdes y un smoke test con curl.
- No escribió ni un test para Redis: lo que está roto es lo único que no probó.
- Dejó `__pycache__` y `.pytest_cache` en la entrega.
