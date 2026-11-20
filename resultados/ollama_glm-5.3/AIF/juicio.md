# AIF · ollama/glm-5.3 · 10/10

**Infinito y de la casa.** Tablero libre, todo alcanzable, mezclas sin receta que dan inventos y contenido sacado de la web.

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
- Carga sin errores; un HTML de 42 KB sin dependencias.
- Jugado con Playwright arrastrando desde la barra al tablero y soltando una ficha sobre otra (`juez/jugar.mjs`): Humano + Café → Developer, Prompt + Terminal → Script, Café + Café → Café Doble, Developer + Script → Código.
- Humano + Script no tiene receta y da «Humano Infinito»; el contador lo apunta aparte como invento (`🧪 8/187 ✦1`).
- `juez/alcanzables.js`: 187 elementos, 192 recetas sin choques, los 187 alcanzables desde los cuatro básicos.
- Buscador, pista, 8 retos en la ayuda (`ayuda-retos.png`), y el progreso se mantiene al recargar.

## Lo que está bien
- Es Infinite Craft: tablero libre, soltar encima, doble clic duplica, ✕ o arrastrar a la barra quita, y las mezclas sin receta siempre dan algo.
- Contenido de la casa sacado de la portada: Programa con IA, Fichómetro (el «saco de boxeo»), Atlas Malandriner como MCP, En Pantuflas, Audio 24/7, «sin alucinar», contenido humano, el selector y la comparativa de modelos, 15 €/mes, Dani Primo, Malandriner.
- La progresión cuenta una historia: de Prompt y Contexto a IA, Agente, Plan Mode y SDD.

## Lo que falta o está mal
- Mucho del árbol es IA y desarrollo en general (ChatGPT, Cursor, Groq…); la parte de Web Reactiva es una rama más.
- «Zona Malandriner» parece una mezcla de «Zona Premium» y «Malandriner».

## Rarezas de la sesión
- Las dos búsquedas web fallaron (una cancelada por el permiso y otra sin resultado); leyó la portada de webreactiva.com con `webfetch`.
- Lo probó a fondo en Chrome con Playwright (arrastrar, combinar, borrar, duplicar) y validó con un BFS que todo era alcanzable.
- 29 peticiones y 2,8 millones de tokens (2,5 de caché).
