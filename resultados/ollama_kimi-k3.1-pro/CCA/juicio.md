# CCA · ollama/kimi-k3.1-pro · 6/10

**Correcto, pero no escala.** Una clase Carrito en Python, limpia y bien validada (Decimal, una moneda por carrito, precio y stock del catálogo, 17 tests), pero sin servicio, sin persistencia y sin nada que responda a «escalable»: el carrito vive en un objeto en memoria y no hay README que lo explique.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se ejecuta | 1 |
| tests en verde | 1 |
| dominio completo | 1 |
| dinero exacto | 1 |
| precio del catálogo y validación | 1 |
| concurrencia | 1 |
| escala horizontal | 0 |
| explica el escalado | 0 |
| **Total** | **6** |

## Validación (en una copia; `juez/juez.py` es mío)
- `unittest`: 17/17; `main.py` da 210,80 EUR.
- 50 hilos añadiendo a la vez: 50 líneas (sin cerrojo; en CPython sale bien por el GIL).
- Producto en USD en un carrito EUR: rechazado. 0,10 × 3 = 0,30.

## Lo que está bien
- Código pequeño y claro (482 líneas), sin dependencias, con validaciones de precio, moneda, stock y cantidades.

## Lo que falta para «escalable»
- Un servicio o API, un almacenamiento compartido, control de concurrencia entre instancias, caducidad, y un README que cuente las decisiones.

## Rarezas de la sesión
- El más corto de todos los CCA: 11 peticiones y 175 k tokens. Entiende «escalable» como catálogo inyectable.
- Dejó __pycache__ en la entrega.
