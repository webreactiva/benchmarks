Sigo leyendo las 300 incidencias por tandas (llevo 175 revisadas) y anotando la clasificación de cada una; después escribo `clasificacion.jsonl`.

---

Las 300 incidencias están clasificadas en `clasificacion.jsonl`, una línea por incidencia con `id`, `tipo`, `superficie` y `areas` (lista, vacía cuando ninguna área encaja).

Clasifiqué a partir del título, los metadatos de la plantilla y los primeros ~550 caracteres del cuerpo de cada incidencia; solo leí más texto en una veintena de casos dudosos. No he hecho una segunda pasada de revisión.

| Tipo | N.º | Superficie | N.º |
|---|---|---|---|
| bug | 264 | app | 191 |
| enhancement | 28 | CLI | 82 |
| documentation | 8 | codex-web | 15 |
| | | extension | 9 |
| | | iOS | 3 |

Las áreas más frecuentes son windows-os (72), sandbox (47), TUI (31), app-server (29) y connectivity (22).

Hay casos donde la etiqueta es una suposición y conviene que los revises:

- **Sin contenido clasificable (21):** están retiradas, vacías o abiertas por error. Les puse `bug` / `app` / sin áreas por defecto, salvo `codex-52113`, que es una suposición a partir del título. Son `codex-52032`, `52113`, `52205`, `52528`, `52988`, `53128`, `53269`, `53477`, `53499`, `53509`, `53534`, `53590`, `53750`, `53818`, `53819`, `53971`, `54329`, `55354`, `55399`, `55816` y `55866`.
- **Android:** no hay superficie para Android, así que `codex-51269` y `codex-52147` quedaron como `app`.
- **Extensiones de navegador (Chrome/Edge):** las puse como `app` con área `browser`, reservando `extension` para la de VS Code.
- **Superficie no indicada:** cuando el texto no dice el cliente (por ejemplo `codex-52105`, `codex-52995`, `codex-54517`) asumí `app`.
- **«Selected model is at capacity» y falsos positivos de políticas de uso:** las dejé sin área porque ninguna de la lista encaja bien.
- **windows-os:** la apliqué solo cuando el problema parece propio de Windows, no a toda incidencia reportada desde Windows.
- **Tipo dudoso:** algunas peticiones enviadas con plantilla de bug las marqué como `enhancement` (`codex-54194`, `codex-56185`, `codex-56541`); la pregunta de `codex-51267` también quedó como `enhancement`, y `codex-56237` como `documentation`.
