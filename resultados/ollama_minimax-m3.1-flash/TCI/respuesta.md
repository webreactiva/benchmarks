I'll start by exploring the working directory to understand the data.

---

This is a substantial classification task (300 issues). Let me set up a workflow to review them systematically.

---

Now let me check details on a few issues where the truncated text may hide key info.

---

I've read all 300 issues. Now let me build the classification.

---

Listo. `clasificacion.jsonl` contiene las 300 incidencias clasificadas (una línea por incidencia, con `id`, `titulo`, `tipo`, `superficie` y `areas`).

**Cómo se hizo:** leí el texto completo de las 300 incidencias y las clasifiqué individualmente; `classify.py` contiene el mapeo y valida que no falte ningún id, que los valores estén dentro de las listas permitidas y que no haya áreas repetidas.

**Distribución resultante:**

| tipo | n | | superficie | n | | áreas más usadas | n |
|---|---|---|---|---|---|---|---|
| bug | 258 | | app | 186 | | windows-os | 55 |
| enhancement | 33 | | CLI | 86 | | sandbox | 48 |
| documentation | 9 | | codex-web | 11 | | session | 42 |
| | | | extension | 11 | | connectivity | 34 |
| | | | iOS | 6 | | remote | 33 |

Criterios aplicados:

- **Superficie**: `app` = Codex/ChatGPT desktop (Windows/macOS/Linux); `CLI` = codex-cli/TUI/daemon; `extension` = extensión de VS Code y extensiones de navegador (Edge/Chrome); `codex-web` = chatgpt.com/codex y Codex Cloud; `iOS` = app móvil (incluí los casos Android, que no tienen categoría propia en la lista).
- **Tipo**: `documentation` para pedidos explícitos de docs/soporte de API (p. ej. lifecycle de `exec_command` en macOS, API de attachment a tasks, cómo reanudar sesiones locales desde web); `enhancement` para feature requests y quejas de UX sin defecto (tema del CLI, custom slash commands, status line, borrado de chats); el resto `bug`.
- **Áreas**: 35 incidencias quedan sin área — son reportes de crash genéricos, issues retiradas ("Withdrawn") o fallos puramente de renderizado sin encaje en ninguna de las 18 áreas. Las queInvoke una sola área (±1) son fallos de superficie muy acotada; los clusters grandes (sandbox de Windows con `os error 32`, fallos de daemon/app-server, "model at capacity", usage/quotas) se etiquetaron con varias áreas coherentes.
