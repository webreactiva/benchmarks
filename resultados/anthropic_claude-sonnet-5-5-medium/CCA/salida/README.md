# Carrito de la compra escalable

Python 3.10+, sin dependencias (Redis opcional).

```
python3 tests/test_cart.py     # tests
python3 -m cart.api            # API en :8000
```

## Decisiones de escalabilidad
- **Servicio sin estado**: cualquier réplica atiende cualquier petición; escala horizontalmente tras un balanceador.
- **Persistencia tras un puerto** (`CartRepository`): `InMemory` para dev/tests, `RedisCartRepository` para producción (TTL para carritos abandonados, sharding por `cart_id` con hash tag en Cluster).
- **Concurrencia optimista**: cada carrito tiene `version`; `save` es compare-and-swap (atómico con Lua en Redis) y el servicio reintenta. Sin locks distribuidos.
- **Dominio inmutable y puro**, dinero en céntimos enteros, precios tomados del `Catalog` en el servidor, límites de tamaño por carrito.

## Siguientes pasos
Cabecera `Idempotency-Key` para reintentos de cliente, fusión de carrito anónimo al iniciar sesión, reserva de stock en el checkout, métricas/rate limiting.
