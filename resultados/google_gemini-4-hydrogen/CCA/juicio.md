# CCA · google/gemini-4-hydrogen · 8/10

**Bien hecho, poca concurrencia.** Un dominio completo y limpio, pero la versión optimista rechaza casi todo cuando llegan muchas altas a la vez, y solo hay memoria.

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
- En una copia: `npm test` compila con `tsc` y pasa 14/14; `npm run demo` crea un carrito de invitado, lo fusiona, aplica un cupón y hace checkout.
- `juez/juez.mjs`, contra `dist/` montado como en la demo:
  - 50 `addItem` a la vez sobre el mismo carrito: 5 bien y 45 con `CONCURRENCY_CONFLICT`. Se guardan 5: no pierde lo aceptado, pero rechaza el 90 %.
  - El precio que manda el cliente se ignora.
  - Cantidad negativa o decimal → `INVALID_QUANTITY`; mil millones → `INSUFFICIENT_STOCK`; cantidad 0 → la acepta.
  - Producto o carrito con `../` → no encontrado.
  - 0,10 × 3 = 30 céntimos; EUR + USD → `INVALID_CURRENCY`; mutar el carrito devuelto no cambia lo guardado.

## Lo que está bien
- Dominio completo: añadir, cambiar cantidad, quitar, vaciar, cupones, promociones (porcentaje, importe fijo, 3x2, por volumen), IVA por categoría, envío gratis por umbral o por peso, fusión de invitado a usuario, caducidad.
- Dinero en céntimos con moneda ISO comprobada; precio siempre del catálogo.
- Checkout que reserva stock y lo libera si falla el guardado.
- El README explica cada decisión de escalado.

## Lo que falta o está mal
- La concurrencia optimista reintenta cinco veces seguidas, sin esperar ni serializar: con 50 altas a la vez acepta 5.
- Solo adaptadores en memoria. Redis o Postgres con `WHERE version = …` quedan en el README.
- No hay servidor ni API: es una librería.

## Rarezas de la sesión
- Un test de concurrencia falló (13/14) y lo arregló subiendo los reintentos por defecto de 3 a 5: ajustó un parámetro hasta que el test pasó.
- Entrega la carpeta `dist/` compilada junto al código.
- 22 peticiones, 678 000 tokens, 0,43 $.
