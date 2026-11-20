# AIF · nemotron-3-ultra-550b-a55b:free · 3/10

**Se ve bien, no se puede jugar.** La primera combinación que probaría cualquiera, HTML + CSS, dice «No hay combinación válida».

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 1 |
| las combinaciones funcionan | 0 |
| progresión | 0 |
| «infinito» | 0 |
| contenido de Web Reactiva | 0 |
| acabado | 1 |
| **Total** | **3** |

## Validación
- Carga sin errores de consola. Un solo HTML de 1276 líneas, sin dependencias.
- Jugando en Chromium: HTML + JavaScript → «HTML Dinámico» (bien); HTML + CSS → «No hay combinación válida» (`capturas/html-css.png`, `html-js.png`).
- `juez/alcanzables.js` (mío) recorre todas las combinaciones posibles desde los 4 elementos base: **se pueden descubrir 4 de 62**.

## Por qué está roto
- `getKey(a, b)` ordena los dos ids alfabéticamente (`css+html`), pero la tabla tiene `'html+css'`. **35 de 62 claves** están en un orden que nunca se busca.
- **11 ingredientes no existen** como elemento (`react`, `rust`, `go`, `websocket`, `kubernetes`, `ci`, `monorepo`…): esas recetas no se pueden hacer ni con las claves arregladas.
- El marcador dice «/ 66 descubiertos».

## Lo que está bien
- La interfaz: barra lateral por categorías con buscador y contador de usos, lienzo con tarjetas, ranuras y botón «Combinar», aviso de descubrimiento, guardar en `localStorage`, exportar e importar.
- Las recetas que hay tienen sentido (HTML + JS = manipulación del DOM, SSR + CSS = Next.js, Redux + JS = Zustand).

## Lo que no cumple del prompt
- **«Con el contenido de Web Reactiva»**: solo sale en el título. Ni podcast, ni comunidad, ni nada propio: es un árbol de tecnologías web cualquiera.
- **«Como Infinite Craft»**: allí combinas arrastrando una cosa sobre otra en el lienzo y cualquier par da algo. Aquí hay una tabla cerrada y unas ranuras.

## Rarezas de la sesión
- 4 peticiones: escribe 47 KB y contesta. No lo abre ni prueba una combinación.
- En el chat presume de «80+ recetas» y de accesibilidad; hay 62 recetas y 4 alcanzables.
