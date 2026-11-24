Listo. Generé `classificacion.jsonl` con 300 líneas, una por incidencia, en el mismo orden que `incidencias.jsonl`.

Cada línea tiene este formato:

```json
{"id": "codex-51098", "tipo": "bug", "superficie": "CLI", "areas": ["sandbox", "app-server", "remote"]}
```

Resumen de la clasificación:

- **Tipo:** 265 `bug`, 26 `enhancement`, 9 `documentation`
- **Superficie:** 191 `app`, 84 `CLI`, 12 `codex-web`, 10 `extension`, 3 `iOS`

Las incidencias retiradas o sin información suficiente se mantuvieron como `bug` y, cuando no había áreas aplicables, se dejó `areas` vacío.
