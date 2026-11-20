Voy a crear el juego. Primero reviso el contenido de Web Reactiva (ya lo tengo: podcast, newsletter, MCP, skills, Claude Code, Zona Malandriner, Atlas, Dani Primo…) y ahora construyo el juego completo en un único HTML con un grafo de recetas curadas + un generador de inventos infinito.

---

Ahora valido el grafo de recetas (que todos los elementos sean alcanzables desde los 4 básicos, sin conflictos ni ingredientes inexistentes):

---

Un conflicto: "Hacker + Prompt" apuntaba a dos elementos. Lo corrijo (Código se queda solo con "Developer + Script"):

---

Datos limpios: 187 elementos, 192 recetas, todo alcanzable. Ahora una prueba de humo en navegador real (si hay Chromium disponible):

---

El juego carga bien (los dbus errors son ruido del sandbox, no JS). Verifico que la interfaz se inicializó correctamente y hago una prueba de la lógica de combinación:

---

El estado inicial funciona: **🧪 4/187**. Ahora hago una prueba funcional completa simulando arrastrar y soltar real (crear nodos, combinar, inventar):

---

El primer combine funcionó (Developer descubierto: 5 items ✓) — el "3 nodos" son los dos nodos con animación de salida (esperé solo 80ms) y mi test eligió nodos que ya estaban desapareciendo. Corrijo el test para esperar las animaciones y re-verifico:

---

Todo funciona: combinar, inventos ("Meta Developer" ⚡), contador con ✦, toasts. Última prueba: persistencia entre sesiones (recarga) y el botón de pista:

---

Error del test, no del juego: intenté arrastrar "Contexto" sin haberlo descubierto. Uso una cadena simple y vuelvo a probar la persistencia:

---

¡Bug encontrado! Las piezas descubiertas se guardaban como claves simples pero la carga esperaba objetos (por eso tras recargar se perdían — y con ellas los inventos generados). Corrijo `saveNow` para persistir también nombre/emoji:

---

Persistencia arreglada (9 items tras recarga ✓). Verifico que los **inventos generados** también sobreviven una recarga:

---

El invento persiste ✓. Pero el borrado con clic derecho dejó 1 nodo (esperaba 0). Aíslo el problema:

---

Aclarado: en test3 el nodo eliminado era el primero de **dos** nodos (el Developer original seguía en el tablero) — el clic derecho funciona bien. En test4 el error final es porque ya no quedaban nodos para probar `.del` y doble clic. Verifico esas dos acciones con nodos de sobra:

---

Todas las interacciones funcionan. Verifico el estado final del archivo:

---

¡Listo! 🎉 **`alquimia-reactiva.html`** (42 KB, un único archivo sin dependencias) está en la carpeta actual y probado de punta a punta en Chrome headless.

## ⚗️ Alquimia Reactiva

Empiezas con los 4 elementos básicos de la web moderna: **🧑 Humano + ☕ Café + 💬 Prompt + ⌨️ Terminal**. Y de ahí, todo el universo de Web Reactiva:

| Para descubrir… | Receta |
|---|---|
| 🤖 IA | Prompt + Contexto |
| 👨‍💻 Developer | Humano + Café |
| 🕵️ Agente | IA + Terminal |
| 🎩 Claude Code | Claude + Terminal |
| ⚛️ Web Reactiva | Podcast + Blog |
| 🧔 Dani Primo | Podcast + Voz |
| 🏝️ Zona Malandriner | Telegram + Comunidad |
| 🧭 Atlas Malandriner | MCP + Biblioteca |
| 🐉 Stack Chino | Kimi + DeepSeek |
| 🌌 Infinite Craft | Juego de Alquimia + Contexto Infinito |

**Contenido**: 187 elementos curados con 192 recetas (MCPs, skills, SDD/OpenSpec, Plan Mode, n8n, Evals, Fichómetro, LinkedIn-5-5, En Pantuflas, AI Slop, la newsletter, el podcast, Kimi/GLM/DeepSeek, Cerebras y Groq, el 15€/mes…), todo alcanzable desde los básicos (validado con BFS).

**Como Infinite Craft**: cualquier combinación sin receta genera un **invento** nuevo y determinista (marcado con ✦) — el juego es infinito.

**Funciones**:
- 🖱️ Arrastrar y soltar con resaltado del objetivo (funciona también en táctil; tap coloca, doble clic duplica, ✕/clic derecho elimina, arrastrar a la barra lateral guarda)
- 💾 Progreso y tablero guardados en `localStorage`
- 💡 Botón de pista, ❓ ayuda con 8 **retos** rastreados, 🔊 sonidito de descubrimiento, 🧹 limpiar tablero y ♻️ reinicio
- 🧪 Contador `descubiertos/187`, buscador con `/`, toasts con confeti en cada primer descubrimiento
- 100% offline, sin APIs ni LLMs — abre el archivo y juega

Créditos incluidos en la ayuda: juego no oficial para la comunidad Malandriner, inspirado en Infinite Craft de neal.fun, con el contenido de webreactiva.com.
