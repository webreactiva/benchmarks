# CCA · ollama/mistral-large-4 · 8/10

**Sólido en un proceso.** Dominio limpio, dinero exacto y validación estricta; la concurrencia se apoya en un cerrojo que no sale del proceso.

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

## Validación
- En una copia sin `__pycache__`: 24/24 tests con `unittest` y la demo, en memoria y con SQLite.
- `juez/juez.py`:
  - 50 `add_item` en hilos con un servicio en memoria: 50 guardadas.
  - Repartidas entre dos `CartService` con `SqliteCartRepository` sobre el mismo fichero: 50 aceptadas y 47 guardadas.
  - La API no admite precio: sale siempre del catálogo.
  - Cantidad 0, negativa, decimal o en texto → error; más de 999 → `InvalidQuantity`; SKU y carrito con `../` → no encontrado.
  - 0,10 × 3 = 0,30 EUR; EUR + USD → error; las líneas del carrito devuelto no se pueden mutar.

## Lo que está bien
- Capas y puertos claros: dominio puro, casos de uso, adaptadores en memoria y SQLite.
- `Money` en céntimos con divisa comprobada y redondeo explícito en porcentajes.
- Descuentos e impuestos como estrategias enchufables, eventos de dominio publicados después de guardar, fusión de carritos, límites de stock, unidades y SKUs.
- README con qué tocar para escalar cada parte.

## Lo que falta o está mal
- La concurrencia es un `RLock` del servicio: con dos procesos sobre el mismo SQLite se pierden actualizaciones sin aviso (3 de 50).
- Sin versión ni operación atómica en el repositorio; Redis o PostgreSQL quedan como «implementar el protocolo».
- No hay servidor ni API: es una librería.

## Rarezas de la sesión
- El primer `unittest` no cargó por un nombre de test con un espacio; lo arregló y pasaron los 24.
- Probó la demo con SQLite en `/tmp/opencode`, fuera de su carpeta (dentro del encierro).
- Entrega las carpetas `__pycache__` junto al código.
- 9 peticiones y 190 000 tokens.
