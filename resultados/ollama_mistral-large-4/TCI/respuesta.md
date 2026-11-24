He leído las 300 incidencias. Ahora escribo la clasificación en `clasificacion.jsonl`:

---

He clasificado las 300 incidencias de `incidencias.jsonl` y guardado el resultado en `clasificacion.jsonl` (una línea por incidencia, con `id`, `tipo`, `superficie` y `areas`).

La validación confirma que:
- Las 300 incidencias quedaron cubiertas, sin IDs extra ni duplicados.
- Todos los valores usan exactamente los vocabularios pedidos (`bug`/`enhancement`/`documentation`, las 5 superficies y las 19 áreas).

Notas sobre criterios usados en casos dudosos:
- Las incidencias "Withdrawn", vacías o "opened in error" se clasificaron igualmente como `bug` según su superficie declarada, ya que el archivo no da otro tipo definido.
- Donde una incidencia tocaba varias áreas (p. ej. el error recurrente de `node_repl.exe` en Windows), incluí `windows-os` + `sandbox` (y `browser`/`remote`/`computer-use` cuando el fallo afectaba también esas capacidades).
- Las peticiones de documentación sobre APIs de app-server (codex-54480/54483/54486/54487/54488/54489) quedaron como `documentation` en superficie `app` con áreas `app-server` y `session`.
