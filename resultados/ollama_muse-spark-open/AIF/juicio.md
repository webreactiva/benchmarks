# AIF · ollama/muse-spark-open · 8/10

**Muy de la casa, pero la rama de IA está bloqueada.** Contenido sacado de cuatro páginas de webreactiva.com con mucho humor de la casa («Combustible oficial del developer. 100 % malandriner», «Dirigible (400 € en tokens)»), mesa libre donde se combina soltando una ficha sobre otra, filtros, pistas y recetas secretas. Pero una receta posterior (IA + Código = Python) pisa a la que anuncia como clave (Código + IA = Prompt): sin Prompt no se puede llegar a agentes, skills, MCP, Claude Code ni SDD. Solo 68 de 102 alcanzables, y el botón «Combinar» no registra nada.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| abre sin errores | 1 |
| mecánica de Infinite Craft | 2 |
| las combinaciones funcionan | 2 |
| progresión | 0 |
| «infinito» | 0 |
| contenido de Web Reactiva | 2 |
| acabado | 1 |
| **Total** | **8** |

## Validación
- Carga sin errores; un HTML de 52 KB sin dependencias.
- Soltar una ficha de la mesa sobre otra combina: Café + Comunidad → networking.
- El botón «Combinar» con los selectores enseña «→ Python ✨ ¡Nuevo!» pero no lo añade ni lo guarda.
- `juez/alcanzables.mjs` (mío, en el navegador con las recetas ya cargadas): 68 de 102 alcanzables. `RECIPES['codigo+ia']` vale `python`: la receta de Prompt está pisada.

## Lo que está bien
- Lo más «malandriner» de todos: descripciones con chiste propio, recetas secretas, «Hecho en pantuflas • sin IA alucinando (bueno, un poco)».

## Lo que falla
- La progresión: todo lo de IA, que es lo central de Web Reactiva, queda fuera por una receta duplicada.
- Un parche al final del código cambia las recetas que apuntan a elementos que no existen por «humo».
- El botón «Combinar» no funciona.

## Rarezas de la sesión
- Presume en la respuesta y en el propio juego de «Prompt = Código + IA» como receta secreta, y es justo la que no funciona.
- Dejó un parche que «arregla» recetas rotas cambiándolas por humo en vez de corregirlas.
- 9 peticiones y 4 lecturas de la web.
