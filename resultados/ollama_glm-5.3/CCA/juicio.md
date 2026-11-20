# CCA · ollama/glm-5.3 · 8/10

**Limpio, una sola instancia.** Una API bien hecha y probada que no pierde altas en una instancia, pero sin control de versión para varias.

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
- En una copia sin `node_modules`, `dist` ni `data`: `npm ci`, `npm run build` y 19/19 tests con vitest. Arranca la API y sirve una interfaz web de demostración.
- `juez/juez.mjs`, con dos instancias que comparten `DB_FILE`:
  - 50 altas a la vez en una instancia: 50 guardadas.
  - Repartidas entre dos instancias: 44 bien y 6 errores 500; se guardan las 44 aceptadas.
  - El precio que manda el cliente se ignora.
  - Cantidad 0, negativa, decimal, enorme o en texto → 400; producto o carrito con `../` → 404; cuerpo vacío → 400.

## Lo que está bien
- Capas y puertos de verdad: el servicio no sabe de Express ni de SQL; adaptador SQLite y otro en memoria.
- Dinero en céntimos; el carrito solo guarda producto y cantidad, y los precios salen del catálogo en cada lectura.
- Descuentos por código, envío gratis por umbral, IVA, checkout que descuenta stock, límites por línea.
- README con las decisiones de diseño y su porqué.

## Lo que falta o está mal
- Sin control de versión ni operación atómica: lee el carrito, suma y reescribe todas sus líneas. Con dos instancias sobre el mismo fichero SQLite hay errores 500 bajo carga.
- El almacenamiento compartido es un fichero SQLite; PostgreSQL queda como «escribir otro adaptador».
- Una sola moneda: no hay nada que mezclar.

## Rarezas de la sesión
- Preguntó con la herramienta de preguntas qué stack usar; el lanzador la cerró y siguió con su opción recomendada.
- Lo probó de punta a punta con curl contra el servidor, incluido que el stock persiste entre reinicios.
- Entrega `dist/` y `data/cart.db` junto al código.
- 31 peticiones y 2 millones de tokens (1,8 de caché).
