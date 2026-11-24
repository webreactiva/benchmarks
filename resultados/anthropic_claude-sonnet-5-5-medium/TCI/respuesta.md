Voy por el lote 3 de 5 (incidencias 120–185); clasifico a mano leyendo cada una y escribiré el archivo al final.

---

He clasificado las 300 incidencias y las he guardado en `/var/tmp/bench/ws-H5DVTBGv/clasificacion.jsonl`, una línea por incidencia. Cada línea tiene `id`, `tipo`, `superficie` y `areas` (lista, vacía si ninguna área encaja).

Clasifiqué a mano a partir del título y de los primeros ~250 caracteres del texto de cada una. No leí los textos completos, así que los casos dudosos pueden ser menos fiables. Un script comprobó que están las 300 y que no hay ids repetidos ni sobrantes.

Para los casos que no encajaban directamente apliqué estos criterios:
- **Superficie:** "Work", "dot" y la app de Android las puse como `app`. Los problemas de Codex Cloud y de la revisión en GitHub los puse como `codex-web`. Los de VS Code, como `extension`.
- **Retiradas y duplicadas:** las incidencias retiradas, cerradas por error o duplicadas, sin contenido útil, quedaron como `bug`, superficie `app` y sin áreas. Dos excepciones: 54830 la dejé en `iOS` porque el propio texto dice que es un problema de ChatGPT iOS, y 56237, que es sobre documentación, como `documentation`.
- **"Selected model is at capacity":** lo marqué como `connectivity`, porque no hay un área de capacidad del modelo. Si prefieres otra área, es un cambio puntual.
- **Preguntas y peticiones:** las preguntas sobre documentación van como `documentation`, y las peticiones de funcionalidad como `enhancement`.
