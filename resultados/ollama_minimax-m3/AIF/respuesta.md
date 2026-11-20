I'll start by exploring the working directory to understand the context and find the "Web Reactiva" content.

---

The directory is empty. Let me look for the "Web Reactiva" content elsewhere on the system.

---

No local "Web Reactiva" content found. Let me check for network access to find that source.

---

Network works. Let me explore the Web Reactiva site.

---

Web Reactiva is a Spanish community for developers working with AI (agents, skills, MCP, Claude Code, OpenCode...). Let me gather their content taxonomy and brand styling.

---

Excellent catalog. Now let me extract the brand design tokens.

---

Brand tokens, fonts, and logo secured. Now let me plan and build.

---

Now I'll build the game. Writing the main file:

---

Now let me validate the dataset and find all gaps:

---

The dataset needs filling in. Let me fix the issues and add the missing elements:

---

Now the big addition — all missing elements:

---

All references resolve. Now fixing the emoji/name collisions:

---

The tree needs many more connections. Let me add a large batch of recipes:

---

The "X+contexto" rule collides (symmetric pairs). Let me inspect existing recipe pairs and rebuild with unique chains:

---

The pair-symmetry constraint needs a smarter approach. Let me restore the clean recipe set and auto-assign unique partners:

---

All 399 elements are now reachable. Let me audit the generated recipes for quality:

---

Dataset complete: 399 elements, 1745 recipes, all reachable and validated. Now let me fix a few JS robustness issues:

---

Now let me inject the brand fonts and logo as base64:

---

The game runs. Let me debug the typed-combine path:

---

Found it — fuzzy name matching picked the wrong "modelo". Let me fix the lookup:

---

Let me add a curated batch of more thematic recipes for the brand elements:

---

Dataset is complete and valid. Let me do a final comprehensive test:

---

Two issues found: logo theme mapping and search preference. Let me verify the logo assets:

---

Let me do a final review of the file structure:

---

Let me add the final polish touches:

---

Listo. **`alquimia-reactiva.html`** (192 KB, un solo archivo, funciona offline con doble clic).

## Qué es
Un clon de Infinite Craft con el contenido real de Web Reactiva: 399 elementos (agentes, skills, MCP, AGENTS.md, SDD/OpenSpec, modelos, la comunidad Malandriner…) y 1780 recetas, más un generador de fusiones infinitas para combinaciones desconocidas.

## Mecánicas
- 4 elementos iniciales (Developer, Prompt, Modelo de IA, Repositorio) + mesa de dos calderos con arrastrar y soltar
- Combinación por texto (`prompt + modelo`), botón aleatorio, y **Pista** que sugiere una receta sin revelar el resultado
- Cada descubrimiento añade su ficha con emoji, categoría y descripción; doble clic abre la ficha completa
- Filtros por categoría (9), búsqueda, orden (descubrimiento/A-Z/categoría), bitácora de combinaciones
- 7 legendarios (Dani Primo, Premium, Malandriner, Atlas, Robotito, Suika Context, Fusión Reactiva) con contador propio
- Progreso en `localStorage`, botón compartir por URL (`#d=…`) e import, tema claro/oscuro

## Identidad de marca
Colores extraídos de su CSS real (violeta `#491eff`, rosa `#ff41c7`, teal `#00c7b5`), tipografía **Sculpin** y el logo oficial embebidos en base64 (ambas variantes, una por tema).

## Sobre el contenido
Extraje el catálogo real de webreactiva.com (glosario de 107 términos, 21 cursos, 9 guías, 419 skills, modelos, herramientas, comunidad) y traduje las combinaciones a la voz de la casa: *«Un LLM predice, no piensa»*, *«Inventa con cara de saber»*, *«La IA dice que funciona. El diff dice otra cosa.»*

Validado con un script propio: 0 ids/nombres/emojis duplicados, 0 referencias rotas, 0 recetas duplicadas y los 399 elementos alcanzables desde los iniciales. Probado en Chromium headless: sin errores de consola, sin desbordamiento horizontal de 360 a 1440 px.
