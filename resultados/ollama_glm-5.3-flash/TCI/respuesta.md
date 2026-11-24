Ya he leído las 300 incidencias. Ahora voy a crear el script que genera `clasificacion.jsonl` con la clasificación (tipo, superficie y áreas) de cada una, validando que los ids coincidan exactamente con el archivo de entrada.

---

Listo. He clasificado las 300 incidencias y guardado el resultado en `clasificacion.jsonl`, con una línea por incidencia en el mismo orden del archivo de entrada:

```json
{"id": "codex-51098", "tipo": "bug", "superficie": "CLI", "areas": ["sandbox", "app-server"]}
```

**Criterios que apliqué:**
- **tipo**: `bug` (defecto), `enhancement` (peticiones de función/UX, p. ej. slash commands, barras de uso, etiquetas de chats importados) y `documentation` (peticiones de documentación, como las 6 copias sobre la API de goals de Codex Desktop o el exec_command de macOS).
- **superficie**: `app` para la aplicación de escritorio (Windows/macOS/Linux), `CLI` para codex-cli/TUI y app-server, `extension` para VS Code y extensiones de navegador, `codex-web` para la web/Codex Cloud, e `iOS` para apps móviles (incluidas las de Android, al ser la única superficie móvil de la lista).
- **áreas**: varias cuando corresponden (p. ej. los fallos "setup refresh had errors" en Windows → `sandbox` + `windows-os`; errores de "model at capacity" → `rate-limits`; la doble contabilización de razonamiento → `context`). Para incidencias retiradas, vacías o sin contenido técnico asigné `areas: []` y `bug` (habían sido presentadas como informes de error), salvo la que se declara explícitamente de iOS.

**Distribución resultante:**
- Por tipo: 260 bug, 31 enhancement, 9 documentation
- Por superficie: 185 app, 84 CLI, 14 codex-web, 11 extension, 6 iOS
- Áreas más frecuentes: sandbox (55), session (52), windows-os (38), connectivity (33), TUI (32), app-server (28)

El script de validación verificó que los 300 ids coinciden exactamente con `incidencias.jsonl` (sin duplicados ni faltantes) y que todos los valores pertenecen a las listas permitidas.
