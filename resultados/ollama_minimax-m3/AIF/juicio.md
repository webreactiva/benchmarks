# AIF · ollama/minimax-m3 · 8/10

**El mejor AIF, con mucho.** Es un juego que se podría publicar en Web Reactiva tal cual.

## Nota del autor

**8/10**, nota definitiva de Daniel Primo. Es muy de Web Reactiva, pero combina en ranuras en vez de en un tablero.

La rúbrica le daba 9/10.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 1 |
| las combinaciones funcionan | 2 |
| progresión | 1 |
| «infinito» | 1 |
| contenido de Web Reactiva | 2 |
| acabado | 1 |
| **Total** | **9** |

## Validación
- Carga sin errores; un solo HTML de 192 KB que funciona sin conexión.
- Seis mezclas de los cuatro elementos iniciales (Developer, Prompt, Modelo de IA, Repositorio): las seis dan algo nuevo («Developer + Modelo de IA = GitHub Copilot: el autocompletado que ya lee tu repositorio») (`capturas/tras-mezclas.png`).

## Lo que está bien
- **Contenido de Web Reactiva de verdad**: 399 elementos y 1780 recetas sacados de la web (glosario, cursos, guías, skills, Malandriner, Atlas, Robotito), con frases en la voz de la casa («Un LLM predice, no piensa», «La IA dice que funciona. El diff dice otra cosa.»).
- **Marca**: logo oficial, colores del CSS real y tipografía Sculpin, todo dentro del HTML.
- Mecánica completa: generador para mezclas sin receta (como el «infinito» de Infinite Craft), 7 legendarios, pista, aleatorio, bitácora, búsqueda y filtros, compartir por URL, tema claro y oscuro.

## Lo que falta
- No hay lienzo libre: se combina en dos calderos. Infinite Craft deja soltar cosas por toda la pantalla.

## Rarezas de la sesión
- 76 peticiones y 11,5 millones de tokens.
- Lanzó un subagente solo para catalogar webreactiva.com: sitemap, `llms.txt`, `openapi.json`, la API de búsqueda y el bundle de skills.
- Descargó el CSS de la web para sacar los colores, y embebió el logo y la fuente en base64.
- `ls /` y `find / -iname "*reactiv*"` buscando contexto: corría encerrado y no encontró nada.
