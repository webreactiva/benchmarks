Creando tu carrito escalable.

---

Implementación base completada — verificando funcionamiento del carrito.

---

**Carrito escalable implementado y verificado** (`main.py` + tests OK + API REST OK).

**Estructura generada en `/var/tmp/bench/ws-6AYtPaRV`:**
- `cart/` - Dominio: `models.py` (Money/Product/Cart), `cart.py` (Aggregate con límites), `storage.py` (Strategy: `InMemoryCartStorage` thread-safe + `ShardedCartStorage` `hash(cart_id)%N` para escalado horizontal + `FileCartStorage`), `pricing.py` (PricingEngine con reglas componibles: `BulkDiscount`, `CategoryDiscount`, `CouponDiscount` + `TaxCalculator` IVA diferencial + `ShippingCalculator`), `inventory.py` (reserva/libera stock), `events.py` (EventBus pub/sub), `service.py` (stateless con optimistic locking `version` + retry/backoff + lock striping por cart_id), `exceptions.py`, `config.py` (12-factor)
- `api/app.py` - REST stdlib sin dependencias (stateless tras LB) + `api/fastapi_app.py` alternativa
- `main.py` - demo completa: sharding 4 shards, concurrencia 10 hilos, checkout, pricing
- `tests/test_cart.py` - 12 tests (concurrencia, sharding, cupones, stock)

**Escalabilidad:** storage intercambiable (Redis/DynamoDB), sharding lineal, locks por cart_id + CAS, Pricing stateless, EventBus desacoplable a Kafka, TTL/expiración, configurado vía env vars.

Uso: `PYTHONPATH=. python main.py` | `python -m api.app` → `http://localhost:8000`
