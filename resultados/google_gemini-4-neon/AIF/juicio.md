# AIF · google/gemini-4-neon · 10/10

**El AIF más documentado.** Mesa libre, todo alcanzable, fusiones para lo que no tiene receta y contenido sacado de ocho páginas de la web.

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
- Carga sin errores; un HTML de 122 KB sin dependencias.
- Jugado con Playwright soltando una ficha sobre otra (`juez/jugar.mjs`): Pantuflas + Código → Developer, Pantuflas + Podcast → Dani Primo, Código + IA → Prompt, Podcast + Podcast → +710 Episodios.
- Dani Primo + Developer no tiene receta: con el Modo Libre apagado no pasa nada; encendido da «Meta-Developer», marcado como fusión libre (`sin-receta-libre.png`).
- `juez/alcanzables.js`: 144 elementos y 360 recetas; los 144 alcanzables desde los cuatro iniciales.
- Buscador, pistas, Atlas Malandriner con rarezas (`atlas.png`), y el progreso se mantiene al recargar.

## Lo que está bien
- Mecánica de Infinite Craft: tablero libre, soltar encima, duplicar, retirar al panel.
- El contenido más pegado a la web de todo el benchmark: Atlas Malandriner, Selector de Modelos, Revisor de AGENTS.md, Bingo de Mentiras, Radar de Capas, Chuleta OpenCode, Robotito, LinkedIn-5-5, Fichómetro, skills con nombre propio, SDD y OpenSpec.
- Atlas con progreso por categoría, ocho legendarios y botón para compartir.

## Lo que falta o está mal
- El Modo Libre viene apagado: sin encenderlo, las mezclas sin receta no dan nada.

## Rarezas de la sesión
- La primera búsqueda web quedó cancelada por el permiso; buscó otra vez y leyó ocho páginas de webreactiva.com con `webfetch`, el que más del benchmark.
- 11 peticiones, 895 000 tokens, 1,50 $: el AIF más caro de los Gemini.
