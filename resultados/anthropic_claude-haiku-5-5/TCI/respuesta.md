Ya tengo las 300 incidencias revisadas por título y resumen. Escribo las clasificaciones en un fichero intermedio y luego lo convierto a JSONL, validando que estén los 300 ids.

---

Ahora convierto a JSONL y valido: ids completos, sin duplicados y valores dentro de las listas permitidas.

---

He clasificado las 300 incidencias y guardé el resultado en `/var/tmp/bench/ws-Rr3Xf0vv/clasificacion.jsonl`, una línea por id y en el mismo orden que el original. Comprobé que están todos los ids, sin duplicados y con valores válidos.

Cada línea tiene este formato:

```json
{"id": "codex-51098", "tipo": "bug", "superficie": "CLI", "areas": ["sandbox", "app-server"]}
```

Resumen:
- **Tipo:** 265 bug, 27 enhancement, 8 documentation.
- **Superficie:** 188 app, 85 CLI, 14 codex-web, 10 extension, 3 iOS.

Decisiones que conviene revisar:
- **Campo extra `nota`:** 29 incidencias están retiradas, cerradas como duplicado o tienen texto vacío o casi vacío. Las he clasificado de forma provisional y lo indico en `nota`. Si no quieres ese campo, se puede quitar.
- **Método:** he usado el título y el inicio de cada texto, no el cuerpo completo de cada incidencia (~3.000 caracteres de media). En casos ambiguos, como la superficie cuando el texto no la dice, he elegido la más probable.
- **Áreas:** las incidencias de sandbox de Windows reciben `windows-os` y `sandbox`. Las de "Selected model is at capacity" van a `rate-limits`, aunque también podrían ser `connectivity`.
- **Sin área:** algunas incidencias (por ejemplo, las de renderizado de la app) quedaron con `areas` vacío porque ninguna área de la lista encajaba bien.
