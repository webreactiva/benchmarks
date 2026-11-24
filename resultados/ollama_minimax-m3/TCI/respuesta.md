I'll start by examining the incidents file and the workspace structure.

---

Now let me examine several ambiguous issues in full detail.

---

I've read all 300 issues. Now let me build the classification with a reproducible script.

---

Listo. He clasificado las 300 incidencias y guardado el resultado en `clasificacion.jsonl` (una línea por incidencia, mismo orden y `id` que el fichero de entrada).

**Formato de cada línea:**
```json
{"id": "codex-51098", "tipo": "bug", "superficie": "CLI", "areas": ["sandbox", "app-server", "remote"]}
```

**Distribución resultante:**

| tipo | n | | superficie | n | | áreas más usadas | n |
|---|---|---|---|---|---|---|---|
| bug | 260 | | app | 185 | | sandbox | 58 |
| enhancement | 31 | | CLI | 85 | | tool-calls | 49 |
| documentation | 9 | | extension | 13 | | config | 49 |
| | | | codex-web | 11 | | session | 48 |
| | | | iOS | 6 | | windows-os | 45 |

Las 18 áreas de la lista se utilizan; 142 incidencias llevan 2 áreas, 110 llevan 1, 28 llevan 3 y una lleva 4.

**Criterios aplicados**
- `superficie`: `app` = Codex/ChatGPT desktop (macOS, Windows, Linux); `CLI` = codex-cli/TUI/`codex exec`; `extension` = extensión de VS Code y extensiones Chrome/Edge; `codex-web` = chatgpt.com (Projects, Codex Cloud, uso); `iOS` = app móvil (incluye Android, que no existe en la lista).
- `tipo`: `enhancement` para peticiones de feature/UX explícitas (31); `documentation` para consultas de documentación e integración (9, p.ej. el bloque de 6 duplicados `54480-54489`); resto `bug`.
- `areas`: derivadas del contenido real, no del título. Clusters grandes: el fallo de `setup refresh had errors` / error 32 sobre `node_repl.exe` → `windows-os` + `sandbox` (unas 25 incidencias repetidas); "Selected model is at capacity" → `rate-limits`; averías de Sparkle/appcast 520 → `connectivity`; daemon/app-server → `app-server` + `config`.

**Dos criterios que conviene que valides**
1. 19 incidencias tienen `areas: []` porque su cuerpo es literalmente "Withdrawn" o un UUID sin contenido (p.ej. `codex-52032`, `codex-53499`, `codex-56376`). No inventé áreas para esos casos; en su lugar elegí `tipo` y `superficie` por defecto.
2. Para defectos puramente de interfaz del desktop sin encaje funcional (emoji picker recortado, texto japonés en cajas, CSS en crudo, barra de input recortada) usé `config` como área genérica de "app/UI"; si tu taxonomía prefiere otra etiqueta para ese bucket, es el punto más fácil de reajustar.

Dejé también `classify.py`, que regenera el fichero de forma determinista y valida que toda incidencia esté clasificada y que los valores pertenezcan a las listas permitidas.
