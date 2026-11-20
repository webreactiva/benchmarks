# CCA · nemotron-3-ultra-550b-a55b:free · 4/10

**Funciona, pero no escala.** Hace un carrito correcto para un solo usuario y una sola petición a la vez. La palabra que distingue este prompt, «escalable», la resuelve con estructura (adaptadores, eventos), no con lo que hace falta para escalar.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se ejecuta | 1 |
| tests en verde | 1 |
| dominio completo | 1 |
| dinero exacto | 0 |
| precio del catálogo y validación | 0 |
| concurrencia | 0 |
| escala horizontal | 1 |
| explica el escalado | 0 |
| **Total** | **4** |

## Lo que entregó
TypeScript, 1167 líneas: `CartService` (añadir, actualizar, quitar, vaciar, resumen), adaptadores de almacenamiento en memoria, en fichero y Redis (sin cliente, `any`), bus de eventos síncrono y asíncrono, límites configurables, 24 tests con Jest y un ejemplo largo. Sin README en el disco: lo cuenta en el chat.

## Validación (en una copia, `juez/juez.ts` es mío)
- `npm ci`, `tsc`, `jest` (24/24) y `npm run dev`: todo en verde.
- **Concurrencia**: 50 `addItem` a la vez sobre el mismo carrito guardan **1** línea, tanto en fichero como en memoria. Lee, modifica y escribe sin bloqueo, sin versión y sin operación atómica. En Redis pasaría lo mismo (`GET` + `SET` del JSON entero).
- **Monedas**: un artículo en EUR y otro en USD dan `subtotal: 20, currency: 'EUR'`.
- **Dinero en coma flotante**: 0,10 × 3 = `0.30000000000000004`.
- **`cart.cleared`** siempre dice `previousItemCount: 0`: cuenta después de vaciar.
- **`InMemoryStorage`** devuelve el objeto guardado: quien lo modifica fuera cambia el carrito sin pasar por el servicio.
- **`FileStorage`** con un id `../fuera` escribe fuera de su carpeta.

## Lo que falta para «escalable»
Control de concurrencia (versión optimista, `WATCH`/`MULTI` o `HSET` por línea en Redis), caducidad de carritos abandonados, precios que vengan del catálogo y no del cliente (`addItem` se cree el precio que le mandan y lo sobrescribe), dinero en céntimos o decimal, una moneda por carrito, y alguna medida o explicación de por qué esto escalaría. Los tests no prueban nada de eso.

## Lo que está bien
- Separación limpia y legible: tipos, almacenamiento, eventos y servicio en ficheros distintos.
- Validaciones de entrada razonables (cantidad, precio negativo, nombre, moneda, límites).
- Se ejecuta y se prueba de verdad: instaló dependencias, corrió tests, ejemplos y build antes de decir que había terminado.

## Rarezas de la sesión
- 25 peticiones y 460 k tokens, frente a 2 peticiones de MWP o PTS. Él solo se gastó la mitad del cupo gratuito del día.
- Primer `npm test` en rojo por un tipo mal puesto (`id` en vez de `productId`): lo arregló en el código. El segundo fallo (esperaba `item.updated`, el código emite `item.quantityChanged`) lo arregló **cambiando el test**.
- Un `edit` con texto viejo y nuevo idénticos, que OpenCode rechazó.
- Dejó `dist/`, `node_modules/` y un carrito de prueba en `data/carts/`.
- Todo en inglés: código, comentarios y la respuesta del chat.
