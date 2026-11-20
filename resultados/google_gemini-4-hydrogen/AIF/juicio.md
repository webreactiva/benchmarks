# AIF · google/gemini-4-hydrogen · 9/10

**De la casa, sin infinito.** Mesa libre, todo alcanzable y contenido sacado de webreactiva.com; las mezclas sin receta no dan nada.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 2 |
| las combinaciones funcionan | 2 |
| progresión | 1 |
| «infinito» | 0 |
| contenido de Web Reactiva | 2 |
| acabado | 1 |
| **Total** | **9** |

## Validación
- Carga sin errores; un HTML de 92 KB sin dependencias.
- Jugado con Playwright arrastrando fichas (`juez/jugar.mjs`): Código + Web → HTML, Web + Podcast → Web Reactiva, IA + Podcast → Robotito, Código + Código → Refactor.
- HTML + Robotito no tiene receta: las dos fichas tiemblan y se quedan en la mesa (`sin-receta.png`).
- `juez/alcanzables.js`: 109 elementos y 255 recetas sin duplicados; los 109 se alcanzan desde los cuatro iniciales, y las diez parejas de iniciales dan algo.
- Buscador, pista, Atlas con rango (`atlas.png`), y el progreso se mantiene al recargar.

## Lo que está bien
- Mecánica de Infinite Craft: mesa libre, soltar una ficha sobre otra, clic para sacar al centro, doble clic para duplicar, papelera.
- Contenido de la web de verdad: Robotito, +710 episodios, la newsletter de los domingos, Zona Premium, En Pantuflas, #RecursosATutiplén, Atlas Malandriner como MCP, Glosario IA, las cinco etapas de «Programa con IA», LinkedIn-5-5, Fichómetro.
- Atlas con descripción y receta de cada descubrimiento, y rangos de jugador.

## Lo que falta o está mal
- No es infinito: fuera de las 255 recetas, mezclar no da nada.
- Algún detalle anecdótico que no se puede comprobar sin más fuentes («Peluca de Dani», «Bocata de calamares»).

## Rarezas de la sesión
- La primera búsqueda web quedó cancelada por el permiso de OpenCode (el lanzador contestó «Decide tú.»). Volvió a buscar, esta vez pasó, y leyó la portada de webreactiva.com.
- Se comprobó con `node`: encontró 8 recetas duplicadas, las quitó y verificó 109/109 alcanzables.
- 8 peticiones, 405 000 tokens, 0,47 $: la mitad de peticiones y de coste que Carbon en el mismo prompt.
