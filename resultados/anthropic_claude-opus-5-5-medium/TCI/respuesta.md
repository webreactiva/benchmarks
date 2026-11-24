Voy a generar un resumen compacto de cada incidencia (título, plantilla usada y comienzo del texto) para clasificarlas.

---

Clasificando por lotes; voy por la incidencia 220 de 300.

---

He clasificado las 300 incidencias y el resultado está en `clasificacion.jsonl`, una línea por incidencia y en el mismo orden que el fichero original:

```json
{"id": "codex-51098", "tipo": "bug", "superficie": "CLI", "areas": ["sandbox", "app-server", "remote"]}
```

He leído el título y los primeros ~450 caracteres de cada una, no el texto completo. En las incidencias largas puede faltar alguna área que solo se mencione más abajo.

**Reparto:**
- **Tipo:** 262 bug, 30 enhancement y 8 documentation. De las 8 de documentation, 6 son la misma petición enviada varias veces (54480–54489).
- **Superficie:** sobre todo app, y después CLI. Hay pocas de extension (VS Code), codex-web e iOS.
- **Áreas más frecuentes:** windows-os y sandbox. Hay muchos informes del mismo fallo de Windows (`setup refresh had errors` / os error 32 en `node_repl.exe`). Le siguen TUI, app-server y rate-limits; aquí están los avisos de "Selected model is at capacity", que he etiquetado como rate-limits.
- Algunas incidencias no tienen ningún área, porque ninguna de la lista encajaba, por ejemplo cuelgues genéricos o problemas de interfaz.

**Casos que he decidido yo y conviene revisar:**
- **Retiradas o vacías (unas 25):** en el texto no queda contenido, así que las he puesto como bug, app y sin áreas. La excepción es 54830, que es de iOS según su propio texto.
- **Android:** la lista no tiene una superficie para Android, así que lo he clasificado como app (51269, 52147).
- **Extensión de Edge** (54503): es el panel lateral del navegador, no la extensión del IDE, así que la he puesto en app con el área browser.
- **Preguntas de uso:** las he puesto como documentation (51267, 56237).
- **Superficie dudosa:** cuando el texto no la dice, he puesto app, por ejemplo en algunos informes de consumo de cuota o de calidad del modelo (52105, 52921, 52995).
