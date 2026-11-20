# Carrito de la compra escalable

Carrito de la compra (shopping cart) diseñado para escalar horizontalmente: arquitectura hexagonal, dominio puro, repositorios intercambiables (memoria o Redis), API HTTP sin estado y eventos de dominio.

## Características clave

| Aspecto | Cómo se resuelve |
|---|---|
| **Escalado horizontal** | La API no guarda estado: cada petición lee/escribe el carrito a través de un repositorio. Con el adaptador Redis, N réplicas detrás de un balanceador comparten los carritos. |
| **Concurrencia** | El repositorio en memoria serializa escrituras con un lock por carrito (no global); el repositorio Redis usa locking optimista (`WATCH`/`WatchError`). |
| **Consistencia** | Cada carrito lleva un campo `version` que incrementa en cada mutación (concurrencia optimista e idempotencia observable). |
| **Extensibilidad** | Puertos (`CartRepository`, `ProductRepository`, `EventPublisher`) desacoplan dominio y negocio de la infraestructura: añadir Postgres, Kafka, etc. no toca el dominio. |
| **Eventos** | `CartService` publica eventos (`cart.created`, `cart.item_added`, `cart.checked_out`…) para integraciones asíncronas (facturación, métricas, colas). |
| **Correctitud monetaria** | Precios y totales con `Decimal`, nunca flotantes. |
| **Límites configurables** | `MAX_DISTINCT_ITEMS` (50) y `MAX_QUANTITY_PER_LINE` (99) en `cart/domain/models.py` protegen la memoria por carrito. |

## Estructura

```
cart/
├── domain/            # Núcleo puro: modelos, excepciones, eventos
│   ├── models.py      # Product, CartItem, Cart (reglas y límites)
│   ├── exceptions.py  # Errores de dominio → códigos HTTP
│   └── events.py      # CartEvent publicable
├── application/       # Casos de uso
│   ├── ports.py       # Protocolos: repositorios y publicador
│   └── services.py    # CartService (crea, añade, actualiza, checkout)
├── infrastructure/    # Adaptadores de almacenamiento y eventos
│   ├── memory.py          # Repositorios en memoria (thread-safe)
│   └── redis_repository.py # Repositorios Redis (opcional: pip install redis)
└── api/
    └── http.py        # API REST sin estado (stdlib, ThreadingHTTPServer)
tests/                 # 24 pruebas: dominio, servicio, concurrencia y API
```

## Puesta en marcha

```bash
pip install -e .            # opcional
python -m cart --host 127.0.0.1 --port 8000
pytest                      # ejecutar las pruebas
```

## API REST

| Método y ruta | Descripción |
|---|---|
| `GET /health` | Estado del servicio |
| `POST /products` `{"name", "price", "id"?}` | Crear producto |
| `GET /products` | Listar productos |
| `POST /carts` | Crear carrito |
| `GET /carts/{id}` | Ver carrito (total, items, version) |
| `DELETE /carts/{id}` | Eliminar carrito |
| `POST /carts/{id}/items` `{"product_id", "quantity"}` | Añadir línea |
| `PATCH /carts/{id}/items/{product_id}` `{"quantity"}` | Cambiar cantidad |
| `DELETE /carts/{id}/items/{product_id}` | Quitar línea |
| `POST /carts/{id}/checkout` | Finalizar compra (total congelado) |

Ejemplo con curl:

```bash
B=http://127.0.0.1:8000
curl -s $B/health
curl -s -X POST $B/products -H 'Content-Type: application/json' \
     -d '{"name": "Teclado", "price": "49.90", "id": "kb"}'
CID=$(curl -s -X POST $B/carts | python -c 'import sys,json;print(json.load(sys.stdin)["cart"]["id"])')
curl -s -X POST $B/carts/$CID/items -d '{"product_id": "kb", "quantity": 2}'
curl -s $B/carts/$CID
curl -s -X POST $B/carts/$CID/checkout
```

Errores en JSON: `{"error": {"code": "cart_not_found", "message": "..."}}` con códigos HTTP (400 validación, 404 no existe, 409 conflicto como duplicados o carrito ya pagado).

## Cambiar a Redis (varias instancias)

```python
from cart.infrastructure.redis_repository import build_redis_service

service = build_redis_service("redis://localhost:6379/0")
server = CartHTTPServer(("0.0.0.0", 8000), service)  # cart/api/http.py
```

```bash
pip install redis
python -m cart --port 8000   # configuración por defecto usa memoria (una sola instancia)
```

Con Redis los carritos viven fuera del proceso: cualquier réplica de la API puede atender cualquier carrito, y los eventos se publican por Pub/Sub para consumidores externos.

## Notas de diseño

- `CartService._mutate` ejecuta la mutación dentro del repositorio: en el adaptador en memoria bajo un lock por carrito; en Redis reintentando con `WATCH` ante modificación concurrente. Así el dominio no conoce hilos ni redes.
- El repositorio devuelve copias (`deepcopy`/nueva instancia), evitando fugas de estado compartido hacia la capa HTTP.
- Los eventos y el repositorio son protocolos: sustituirlos por RabbitMQ/Postgres es un ejercicio de adaptadores, no de refactor del dominio.
