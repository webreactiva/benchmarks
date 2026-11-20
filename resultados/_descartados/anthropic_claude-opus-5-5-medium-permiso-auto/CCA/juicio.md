# CCA · claude-opus-5-5 (Claude Code, esfuerzo medio) · 3/10 (provisional)

**Cortado a medio hacer.** Lo que hay está bien hecho, pero es la mitad de abajo: ni servicio, ni API, ni tests, ni README.

> **Fallo del arnés.** A los cuatro minutos Claude Code pidió permiso para un comando («Claude Code can't be sure it read this command the way the shell will, so it can't rule out a dangerous removal») y el lanzador dio la sesión por acabada, como pasó con el primer intento de Sonnet y el diálogo de `pyright-lsp`. Es un fallo técnico, no del modelo: esta prueba debería ir a `_descartados/` y repetirse. La nota solo mide lo que quedó en disco.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se ejecuta | 0 |
| tests en verde | 0 |
| dominio completo | 1 |
| dinero exacto | 1 |
| precio del catálogo y validación | 1 |
| concurrencia | 0 |
| escala horizontal | 0 |
| explica el escalado | 0 |
| **Total** | **3** |

## Lo que entregó
TypeScript para Node 22 sin dependencias, 860 líneas en 9 ficheros: dominio puro del carrito (`domain/cart.ts`: líneas, cupones, fusión de carritos, estados, límites), errores con código y estado HTTP, motor de precios con promociones e IVA en puntos básicos, puertos y adaptadores en memoria de catálogo, inventario con reservas, repositorio con versión y TTL, almacén de idempotencia, y un cliente Redis RESP2 escrito a mano. `package.json` apunta a `src/main.ts`, `src/cluster.ts` y `test/*.test.ts`, que no existen; `src/service`, `src/http`, `src/events` y `test/` están vacías. No hay respuesta en el chat.

## Validación (en una copia; `juez/juez.ts` es mío)
- `tsc --noEmit` con TypeScript 5.8.3: sin errores.
- `npm start`: no encuentra `src/main.ts`. `npm test`: 0 tests.
- **Concurrencia**: no hay servicio que haga «leer, añadir, guardar» ni que reintente. Con el bucle mínimo escrito por el juez sobre su repositorio, 50 altas a la vez dan 1 guardada y 49 `ConcurrencyError`: no se pierde nada en silencio, pero tampoco entra nada. Además `save` no sube la versión; eso le tocaba al servicio que no llegó.
- **Moneda**: USD en un carrito EUR → `VALIDATION_ERROR`.
- **Dinero**: 0,10 × 3 = 30 céntimos.
- **Id `../fuera`**: `newCart` lo acepta (la validación del id iría en la capa HTTP, que no existe).
- **Objeto devuelto**: no está congelado, pero el repositorio guarda JSON y `get()` da una copia: tocarla no cambia lo guardado.

## Lo que está bien
- Dominio de funciones puras pensado para «leer → calcular → guardar con CAS» y reintentar.
- Validación cuidadosa: SKU con patrón, moneda ISO 4217, cupones normalizados, cantidad entera entre 1 y 99, máximo de líneas y de cupones.
- Fusión de carrito de invitado idempotente (`mergedFrom`) y reprecio desde el catálogo.

## Lo que falta o está mal
- Todo lo que haría de esto un carrito escalable: servicio, API sin estado, repositorio de Redis, idempotencia conectada, tests y README.
- No hay función de vaciar el carrito.
- El cliente Redis no lo usa nadie.

## Rarezas de la sesión
- Termina en un diálogo de permisos de Claude Code sobre su séptimo comando; `respuesta.md` está vacía y la pantalla enseña el diálogo con la cuenta atrás.
- Creó las carpetas del plan entero antes de escribir nada; la mitad quedó vacía.
- Antes de tener servicio, escribió su propio cliente Redis (RESP, pipelining, AUTH, reconexión) para no depender de `ioredis`.
- 6 peticiones, 296 k tokens, 230 s y 0,78 $.
- Sin encierro: `scripts/fugas.py` no encuentra lecturas fuera de `/var/tmp/bench/ws-NICXkEJK`; el único comando de exploración fue `ls -la` en su carpeta y las versiones de node, npm, python y docker.
