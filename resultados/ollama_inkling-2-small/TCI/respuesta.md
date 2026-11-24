Voy a explorar el fichero para entender el formato y las superficies mencionadas antes de clasificar.

---

Tengo una visión general clara. Voy a repartir la clasificación entre subagentes en paralelo con una rúbrica estricta, y luego consolidaré y validaré. Primero preparo los lotes:

---

He lanzado 6 subagentes en paralelo, cada uno clasifica 50 incidencias con una rúbrica común (tipo, superficie, áreas) y verificación de cobertura. Mientras tanto, preparo el script de consolidación y validación para cuando terminen.

---

Los subagentes están trabajando. Cuando terminen consolidaré los 6 lotes en `clasificacion.jsonl` y validaré el resultado.

---

Me he equivocado al invocar el subagente; no hace falta. Espero a que los 6 lotes en segundo plano terminen y entonces consolido.

---

Espero a que terminen los subagentes; no haré más consultas hasta recibir sus notificaciones.

---

El lote 5 está listo. Espero al resto de lotes antes de consolidar.

---

Voy a esperar a los demás lotes. Mientras, noto que hay issues con áreas vacías que revisaré al final.

---

Lote 1 completado. Espero a los lotes 2, 3 y 6.

---

Lote 2 listo. Espero a los lotes 3 y 6.

---

Lote 3 listo. Espero al lote 6.

---

Los 6 lotes están completos. Ahora consolido y valido:

---

El merge sobrescribió las correcciones. Las reaplico (y de paso a los lotes, para que todo quede consistente):

---

Correcciones aplicadas. Validación final del fichero:

---

Listo. He clasificado las 300 incidencias en `/var/tmp/bench/ws-MQrVAzPw/clasificacion.jsonl` — una línea JSON por incidencia con `id`, `tipo`, `superficie` y `areas`, en el mismo orden que `incidencias.jsonl`.

**Resultado global**
- **Tipo**: 261 bug, 29 enhancement, 10 documentation
- **Superficie**: 182 app (escritorio), 80 CLI, 20 codex-web, 12 extension, 6 iOS
- **Áreas más frecuentes**: windows-os (66), sandbox (57), session (48), tool-calls (43), app-server (32), TUI (31); 28 incidencias no encajan en ninguna área (mayormente "Withdrawn" sin contenido o bugs puramente de UI sin categoría aplicable)

**Cómo se hizo**: lectura completa de los textos por 6 agentes en paralelo con una rúbrica común (definiciones por tipo/superficie/área y reglas para casos ambiguos, p. ej. "model at capacity" → rate-limits, HTTP 5xx de red → connectivity, issues de Android → iOS por ser la categoría móvil disponible), seguida de revisión manual de una muestra amplia, corrección de asignaciones inconsistentes y validación final de esquema, cobertura (300/300 ids, sin duplicados, valores dentro de los enumerados).

**Limitaciones a tener en cuenta**:
- Las issues "Withdrawn"/vacías o con solo un UUID no aportan señal; se clasificaron como `bug` con confianza baja.
- La superficie Android no existe en tu lista; esas issues se asignaron a `iOS` (categoría móvil).
- Algunos bugs puros de UI (p. ej. "LaTeX roto en VS Code") quedaron con `areas: []` al no encajar en ninguna categoría de la lista.
- Casos frontera (p. ej. "Chat mode missing" → auth por la sección de cuenta ausente, "Install.sh 404" → bug) son decisiones de criterio; puedo ajustar cualquiera si me indicas tus preferencias.
