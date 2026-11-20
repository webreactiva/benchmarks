I'll start by exploring the working directory and understanding what "Web Reactiva" content means.

---

Web Reactiva es sobre IA para developers (Claude Code, OpenCode, MCP, skills, SDD, agentes...). Voy a recopilar su contenido real para que el juego sea auténtico.

---

Ya tengo el contenido real de Web Reactiva (agentes, skills, MCP, SDD, modelos, herramientas). Ahora construyo el juego.

---

Corrijo pares duplicados, emojis y una referencia rota:

---

Grafo validado: 203 elementos, 199 recetas, todo alcanzable y sin ciclos. Ahora el HTML.

---

Encontré un fallo real: usé `<canvas id="mesa">` y los hijos dentro de un canvas no se renderizan. Lo cambio a `div`:

---

Funciona. Ahora refino detalles de UX (tooltips, móvil, Ayudas):

---

El grafo queda profundo y coherente. Últimos detalles: niveles "raros", tipografía y celebración final.

---

Listo. `alquimia-web-reactiva.html` (69 KB, un único archivo, cero dependencias externas) en la carpeta actual.

**Cómo funciona**: 4 elementos base (💬 Prompt, 🤖 Modelo, 📚 Contexto, 🔧 Herramienta) que arrastras uno sobre otro en una mesa. Cada par da un elemento nuevo; los descubiertos se guardan en una biblioteca lateral con buscador.

**El contenido es real de Web Reactiva** (lo extraje del sitio: `/ia`, `/skills`, `/cursos`, `/blog`, `/now`, comparadores):
- **203 elementos / 199 recetas** en 15 niveles, verificados sin ciclos, sin pares duplicados y con los 203 alcanzables desde la base.
- Familias: agentes (Claude Code, Codex, OpenCode, Cursor, Copilot, Gemini CLI, Antigravity, Devin), skills (SKILL.md, skill-creator, ELI5, grill-me, handoff-torch, skills.sh, Cook-First), SDD (Spec, OpenSpec, Spec Kit, GSD, PAUL, Superpowers, ODD), MCP, RAG/embeddings/vector DB, hooks, commits, evals, CI, contenedores, costes (tokens, ventana de contexto, Headroom, facturas), seguridad (prompt injection, guardrails, red team, SSH, secretos) y la capa de marca (Dani Primo, podcast, Premium, Zona Malandriner, Atlas Malandriner, En pantuflas).

**Extras**: pista de combinación, recetario de lo desbloqueado, código para compartir progreso, guardado automático en `localStorage`, sonido con WebAudio, rarezas doradas en la，终 and responsive con cajón en móvil.

Dos fallos que encontré y corregí durante las pruebas: usaba `<canvas id="mesa">` (los hijos dentro de un canvas no se renderizan, la mesa quedaba vacía) y el título de la cabecera se solapaba con los contadores por debajo de 430 px. Probado en Chrome headless: combinación por arrastre, por toque, persistencia tras recargar, biblioteca completa y layout de 320 px a 1920 px sin errores de consola.
