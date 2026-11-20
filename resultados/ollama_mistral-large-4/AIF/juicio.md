# AIF · ollama/mistral-large-4 · 6/10

**Funciona, sin Web Reactiva.** Un juego de combinar completo y bien conectado, sin la mecánica de soltar, sin infinito y sin el contenido de la casa.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 1 |
| las combinaciones funcionan | 2 |
| progresión | 1 |
| «infinito» | 0 |
| contenido de Web Reactiva | 0 |
| acabado | 1 |
| **Total** | **6** |

## Validación
- Carga sin errores; un HTML de 27 KB sin dependencias.
- Jugado con Playwright (`juez/jugar.mjs`): un clic en la lista saca la ficha al lienzo y se combinan seleccionando dos. Computadora + Internet → Navegador, Papel + Internet → Periódico, Computadora + Electricidad → Programa.
- Arrastrar una ficha sobre otra solo la mueve: no combina.
- Papel + Electricidad no tiene receta: las fichas tiemblan y no sale nada.
- `juez/alcanzables.js`: 268 elementos y 264 recetas, los 268 alcanzables desde las cuatro bases.
- Pista, buscador y guardado (7/268 tras recargar).

## Lo que está bien
- Árbol grande y bien conectado, sin recetas rotas.
- Pista que resalta dos ingredientes, sonido, responsive y táctil.

## Lo que falta o está mal
- La mecánica es seleccionar dos fichas, no soltar una encima.
- No es infinito.
- Contenido de desarrollo web genérico (React, Vite, Docker, Vercel…). De Web Reactiva solo el nombre, como Podcast + Comunidad, y «Episodio» y «Entrevista».

## Rarezas de la sesión
- No intentó buscar nada sobre Web Reactiva: lo resolvió con un elemento «Web Reactiva» y una fanfarria al crearlo.
- Validó con `node` que no hubiera recetas duplicadas ni ingredientes huérfanos y que todo fuera alcanzable.
- 9 peticiones y 267 000 tokens.
