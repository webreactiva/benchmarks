He creado el juego en **`/tmp/bench-ws/claude-haiku/AIF/alquimia-web-reactiva.html`**. Es un único archivo HTML sin dependencias externas.

**Cómo funciona**
- Empiezas con cuatro elementos: Código, Humano, Idea y Café.
- Arrastra elementos a la mesa y suelta uno encima de otro para combinarlos. En móvil, toca un elemento y luego otro.
- Hay 54 elementos y 50 combinaciones. Comprobé con un script que todos los elementos son alcanzables desde los cuatro iniciales y que todas las referencias son válidas.
- El progreso se guarda en `localStorage`. También incluye búsqueda, un botón de pista, limpiar la mesa, reiniciar y modo oscuro automático.

**Contenido**
Los elementos salen de los temas que aparecen en webreactiva.com: programación con IA, agentes, skills, MCP, Spec-Driven Development (SDD), OpenSpec, Claude Code, Cursor, Copilot, n8n, RAG, evals, AI slop, deuda técnica, el podcast y los cursos. Ejemplos de combinaciones: Prompt + Código → Asistente, Asistente + Terminal → Claude Code, Especificación + Agente → SDD, Agente + Agente → Multiagente.

**Decisiones que tomé**
- **Combinaciones curadas a mano, no generadas por IA.** Infinite Craft usa un modelo para inventar resultados. Aquí, una mezcla sin receta muestra "Esa mezcla no da nada…". Añadir más recetas es editar el array `RECIPES`.
- **Interfaz en español**, porque el contenido de Web Reactiva también lo es.
- El pie de página indica que es un proyecto no afiliado a webreactiva.com.

**Limitaciones**
- No lo he probado en un navegador real. Verifiqué la sintaxis del script y el grafo de recetas, pero el arrastre con ratón y táctil no está comprobado.
- Solo he consultado la página principal de Web Reactiva. No revisé cada curso ni episodio, así que algunos términos podrían faltar o sobrar.

No lo he publicado; si quieres una URL compartible, puedo hacerlo.
