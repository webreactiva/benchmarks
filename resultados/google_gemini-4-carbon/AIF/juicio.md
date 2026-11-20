# AIF · google/gemini-4-carbon · 10/10

**El AIF más completo.** Mesa libre, todo alcanzable, mezclas infinitas y contenido de la casa.

> Segunda tirada: en la primera, la ruta por defecto de OpenRouter (Google Vertex) cortó tres veces seguidas la petición que escribía el juego con «502 Network connection lost». Está en `_descartados/google_gemini-4-carbon-vertex-502/`. Esta fue por Google AI Studio.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 2 |
| las combinaciones funcionan | 2 |
| progresión | 1 |
| «infinito» | 1 |
| contenido de Web Reactiva | 2 |
| acabado | 1 |
| **Total** | **10** |

## Validación
- Carga sin errores; un HTML de 115 KB sin dependencias.
- Jugado con Playwright arrastrando fichas en el lienzo (`juez/jugar.mjs`): Código + Café → Programador, Micrófono + Micrófono → Podcast, Código + Código → Web, Web + Podcast → Web Reactiva, Programador + Web Reactiva → Daniel Primo.
- Café + Web no tiene receta y da «Micro-Web con Café», marcado como primer descubrimiento (`infinito.png`).
- `juez/alcanzables.js`: 112 elementos, 389 pares con receta, los 112 alcanzables desde los cuatro iniciales. Una receta repetida queda pisada por la primera.
- Buscador, pista, códice por categorías con 13 logros (`codice.png`), y el progreso se mantiene al recargar.

## Lo que está bien
- Es la mecánica de Infinite Craft: mesa infinita con zoom, soltar una ficha sobre otra, duplicar con doble clic y borrar arrastrando al panel.
- Las diez parejas posibles de los cuatro iniciales dan algo, así que no hay arranque en vacío.
- Mucho de Web Reactiva: malandriner, Daniel Primo, Zona Premium, grupo de Telegram, café virtual, mastermind, newsletter, «Deploy en viernes», «Cementerio de dominios», aprender en público. Las descripciones tienen el tono de la casa.

## Lo que falta o está mal
- Sale de memoria: no pudo buscar en la web. Hay detalles sin comprobar, como «todos los martes» o «Episodio 500».
- Un tercio de los elementos son tecnologías genéricas (HTML, CSS, Docker, Stripe…).

## Rarezas de la sesión
- Intentó buscar Web Reactiva en la web. OpenCode pidió permiso, el lanzador cerró el diálogo y le contestó «Decide tú.», y siguió sin buscar.
- Escribió un esqueleto y lo rellenó por secciones con 7 `edit`. Se comprobó con `node`: ids inexistentes, pares en conflicto y alcanzabilidad. Corrigió lo que salió.
- 16 peticiones, 643 000 tokens (475 000 de caché), 1,09 $.
