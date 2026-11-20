# CCA · ollama/deepseek-v4.1-flash · 6/10

**Bonito; escala el código, no el sistema.** Es el CCA que mejor se ve y el que menos responde a «escalable».

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| se ejecuta | 1 |
| tests en verde | 1 |
| dominio completo | 1 |
| dinero exacto | 1 |
| precio del catálogo y validación | 1 |
| concurrencia | 0 |
| escala horizontal | 0 |
| explica el escalado | 1 |
| **Total** | **6** |

## Lo que entregó
JavaScript con módulos ES, sin dependencias, 1233 líneas: dominio `Cart`, motor de precios con reglas, cupones, envío e IVA, `CheckoutService`, adaptadores de almacenamiento (memoria y `localStorage`), bus de eventos, una interfaz web («Nébula Store», 11 productos) y un `server.js` estático. 23 tests.

## Validación (en una copia)
- `npm test`: 23/23.
- `npm start` y Playwright: la tienda carga sin errores, «Añadir» mete el producto y el contador del carrito sube (`capturas/tienda.png`).
- No hay backend: el carrito se guarda en el `localStorage` del navegador. Las pruebas de concurrencia, moneda o id de carrito que pasé a los demás no tienen dónde aplicarse.

## Lo que está bien
- Dinero en céntimos, precios del catálogo, motor de reglas de precio y cupones bien separado.
- Persistencia intercambiable por un adaptador: el README explica cómo añadir otro.
- La interfaz es la más trabajada de todo el benchmark.

## Lo que falta para «escalable»
- Un servidor con estado compartido: sin él no hay concurrencia, ni varias instancias, ni carrito que sobreviva a cambiar de dispositivo.
- Todo lo que hace escalar un carrito (versionado, almacenamiento compartido, caducidad) queda fuera.

## Rarezas de la sesión
- Se inventó una tienda entera con catálogo, valoraciones y emojis.
- 26 peticiones y 1,14 millones de tokens.
- Listó la carpeta de sus propias pruebas anteriores (A3D, MWP) buscando contexto; no tocó las de otros modelos. Corrió antes del encierro.
