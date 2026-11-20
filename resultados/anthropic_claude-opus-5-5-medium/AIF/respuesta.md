Ahora compruebo las recetas: que no haya duplicados ni elementos inalcanzables.

---

Te he dejado el juego en `/var/tmp/bench/ws-lOeeTezo/alquimia-reactiva.html`. Es un único HTML, sin dependencias, y se abre directamente en el navegador.

He comprobado con un script que no hay recetas duplicadas, que se puede llegar a los 178 elementos desde los cuatro iniciales y que el JavaScript no tiene errores de sintaxis. No lo he probado en un navegador, así que el arrastre, las animaciones y la vista en móvil están sin verificar.

**Cómo se juega**
- Empiezas con 💻 Código, ☕ Café, 💡 Idea y 🐛 Bug.
- Arrastras elementos desde la lista al tablero y sueltas uno encima de otro para combinarlos.
- Doble clic duplica un elemento. Clic derecho, o arrastrarlo de vuelta a la lista, lo borra.
- En móvil, al tocar un elemento de la lista aparece en el tablero y desde ahí se arrastra.

**Contenido (178 elementos)**
- **Web Reactiva:** Podcast, Newsletter, Episodio, Oyente, Web Reactiva, Dani Primo, Malandriner, Comunidad Malandriner y Web Reactiva Premium.
- **Programación:** Git, Pull Request, HTML/CSS/JS, React, Vue, Node.js, TypeScript, Docker, Kubernetes, CI/CD, IA, Vibe Coding, Linux, Vim, Rust, Python, SQL…
- **Vida de programador y bromas de la profesión:** Junior → Senior → Arquitecto, Síndrome del impostor, Burnout, Deadline, Centrar un div, Deploy en viernes, Salir de Vim, Funciona en mi máquina, Esto pudo ser un email, Infierno de tutoriales…

Por ejemplo, Web + Reactividad da 💜 Web Reactiva, y Web Reactiva + Oyente da 😎 Malandriner.

**Extras**
- Contador de progreso y cinco objetivos: Web Reactiva, Dani Primo, Malandriner, Comunidad Malandriner y Web Reactiva Premium.
- Botón de pista, buscador y tres formas de ordenar la lista (llegada, nombre o emoji).
- El progreso se guarda en `localStorage`.
- Modo claro y oscuro automático, y diseño adaptado a móvil.

**Diferencia con Infinite Craft:** allí una IA inventa un resultado para cualquier pareja. Aquí las recetas son fijas, así que una combinación que no existe solo da un mensaje de broma ("Eso no compila", "404: combinación no encontrada"…). Para ampliar el juego basta con añadir líneas `A + B = emoji Resultado` al bloque `RECIPES_TXT` del archivo.

Dani Primo aparece por su nombre como elemento, porque es quien lleva Web Reactiva. Si vas a compartir el juego, quizá quieras confirmar que le parece bien.
