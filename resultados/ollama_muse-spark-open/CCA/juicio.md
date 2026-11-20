# CCA · ollama/muse-spark-open · 9/10

**Bien pensado, sin Redis.** Python sin dependencias: agregado de carrito con límites, motor de precios con reglas (por volumen, categoría, cupón), IVA y envío, reserva de stock, bus de eventos, servicio sin estado con versión optimista y reintentos, almacenamiento en memoria, en fichero o repartido en shards, y una API REST. Pasa 12 tests y 50 hilos no pierden nada. Pero Redis o DynamoDB son solo un contrato.

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

## Validación (en una copia; `juez/juez.py` es mío)
- `pytest`: 12/12 (con `unittest` no se encuentran: están escritos para pytest). `main.py` corre la demo entera.
- 50 hilos añadiendo a la vez con 4 shards: 50 unidades, sin errores.
- `add_item(cart_id, product_id, quantity)`: el precio sale del inventario, no del cliente.

## Lo que está bien
- El almacenamiento comprueba la versión esperada al guardar y el servicio reintenta con espera: así aguantaría varias instancias con un almacenamiento compartido.
- Shards por `hash(cart_id) % N`, caducidad de carritos, configuración por variables de entorno, y un README que lo explica.

## Lo que falta
- Un almacenamiento compartido de verdad: Redis y DynamoDB aparecen en comentarios y en `requirements.txt` como opcionales.

## Rarezas de la sesión
- Ofrece dos API: una con la librería estándar y otra con FastAPI.
- 24 peticiones y 604 k tokens.
- Dejó __pycache__ en la entrega.
