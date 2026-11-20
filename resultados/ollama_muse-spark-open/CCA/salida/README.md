# 🛒 Carrito de la Compra Escalable

Implementación en Python con arquitectura hexagonal (ports & adapters), pensada para escalar horizontalmente a millones de carritos y alto throughput.

## 📁 Estructura

```
.
├── cart/
│   ├── models.py      # Dominio: Product, Cart, CartItem, Money (Value Object)
│   ├── cart.py        # CartAggregate - invariantes y reglas de negocio
│   ├── storage.py     # CartStorage ABC + InMemory / Sharded / File
│   ├── pricing.py     # PricingEngine + Rules (bulk, coupon, category) + Tax + Shipping
│   ├── inventory.py   # InventoryService + InMemoryInventory
│   ├── events.py      # EventBus (pub/sub) desacoplado
│   ├── service.py     # CartService - orquestación stateless
│   └── exceptions.py  # Errores de dominio
├── api/
│   ├── app.py         # REST stdlib (sin deps) - escalable tras LB
│   └── fastapi_app.py # Alternativa FastAPI con OpenAPI
├── tests/test_cart.py # Tests unitarios + concurrencia + sharding
├── main.py            # Demo interactiva completa
├── config.py          # 12-factor config via env vars
└── requirements.txt
```

## 🧠 Principios de Escalabilidad

| Problema | Solución en este proyecto |
|----------|---------------------------|
| **Throughput por carrito** | `CartStorage` abstrae backend (Redis/DynamoDB/Postgres). `ShardedCartStorage` distribuye por `hash(cart_id) % N` → escala lineal añadiendo shards/nodos. |
| **Contención concurrente** | Lock striping por `cart_id` + optimistic locking con `version` (CAS). Retry con backoff exponencial. Stateless service → N instancias tras LB. |
| **Consistencia de stock** | `InventoryService` con reserva/libera (`reserve/release`) + confirmación atómica en checkout. Evita overselling. |
| **Cálculo de precios** | `PricingEngine` con Strategy: reglas componibles, stateless, cacheables. Soporta bulk, cupones, categorías, IVA diferencial y envío. |
| **Eventual consistency** | `EventBus` pub/sub desacoplado. En prod se cambia por Kafka/RabbitMQ sin tocar dominio. |
| **Crecimiento de datos** | Carritos con `expires_at` (TTL 7d) + job `clear_expired()`. Paginación `list_by_user`. Shard stats para rebalanceo. |
| **Observabilidad** | Eventos tipados (`ITEM_ADDED`, `CHECKED_OUT`...) + historial + métricas por shard. |
| **Despliegue** | 12-factor (`config.py` via env), sin estado en servicio, compatible con Kubernetes HPA. |

### Diagrama de arquitectura

```
[Client] -> [LB/Nginx] -> [CartService * N (stateless)] -> [Storage Shard 0..N] 
                                         |-> [Inventory Service]
                                         |-> [PricingEngine (stateless)]
                                         `-> [EventBus -> Kafka -> Analytics/Email]
```

Cambio de backend sin tocar dominio:

```python
# De InMemory a Redis solo cambiando construcción:
storage = RedisCartStorage(redis_client)  # implementa CartStorage
service = CartService(storage, inventory, pricing, event_bus)
```

## 🚀 Uso Rápido

### 1. Demo CLI
```bash
python main.py
# Crea carritos, aplica descuentos, prueba concurrencia 10 hilos, checkout, stats de shards
```

### 2. API REST (stdlib, sin instalar nada)
```bash
python -m api.app
# -> http://localhost:8000
```

```bash
# Crear carrito
curl -X POST http://localhost:8000/carts -H "Content-Type: application/json" -d '{"user_id":"alice"}'
# -> {"id":"...", "user_id":"alice", ...}

# Añadir item
curl -X POST http://localhost:8000/carts/<id>/items -d '{"product_id":"P001","quantity":2}' -H "Content-Type: application/json"

# Ver carrito + pricing
curl http://localhost:8000/carts/<id>

# Cupón
curl -X POST http://localhost:8000/carts/<id>/coupon -d '{"code":"BIENVENIDO10"}' -H "Content-Type: application/json"

# Checkout
curl -X POST http://localhost:8000/carts/<id>/checkout
```

### 3. Programático

```python
from decimal import Decimal
from cart import ShardedCartStorage, InMemoryInventory, CartService, PricingEngine, BulkDiscountRule

inventory = InMemoryInventory.with_sample_data()
storage = ShardedCartStorage(num_shards=4)
service = CartService(storage, inventory, PricingEngine(rules=[
    BulkDiscountRule("P002", 3, Decimal("15"))
]))

cart = service.create_cart(user_id="user-123")
service.add_item(cart.id, "P001", 1)
service.add_item(cart.id, "P002", 3)
print(service.get_pricing(cart.id).total)  # Money con descuentos + IVA + envío
order = service.checkout(cart.id)
```

## 🧩 Extensiones Futuras (preparadas)

- **Persistencia**: implementar `CartStorage` para Redis (con SETEX TTL), DynamoDB (GSI por user_id), Postgres (JSONB + row lock).
- **Auth**: añadir `user_id` desde JWT, `merge_carts` para anonymous → authenticated.
- **Idempotencia**: añadir `idempotency_key` en POST items para retries seguros.
- **CQRS**: separar lectura (pricing cache en Redis) de escritura.
- **Observabilidad**: instrumentar con Prometheus (contador por evento, histograma latencia checkout).

## ✅ Tests

```bash
python tests/test_cart.py          # sin deps
# o
pytest tests/ -v
```

Incluye: creación, bulk discount, cupones, stock, concurrencia 20 hilos, sharding, checkout, límites, expiración.

## ⚙️ Configuración

Variables de entorno (ver `config.py`):

```
CART_STORAGE=memory|sharded|file|redis
CART_SHARDS=4
CART_MAX_UNIQUE=100
CART_MAX_QTY=99
CART_TTL_DAYS=7
CART_CURRENCY=EUR
CART_TAX_RATE=0.21
CART_FREE_SHIPPING=50
CART_SHIPPING_RATE=4.99
```

---
Diseño DDD + SOLID, 100% testable sin mocks de infra.
