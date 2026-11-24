# gpt-6-luna (medium)

Agente: Codex CLI. Fechas: 2026-11-24 a 2026-11-24.

**Nota media: 0,0 / 10** (1 de 5 prompts juzgados). Total: 8 peticiones y 247,0 k tokens.

Pendientes: A3D, AIF, CCA, SEC.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [TCI](TCI/juicio.md) | clasificación | 8 | 247,0 k | 0 | Regex en vez de leer | Tipo 90,0 %, superficie 75,3 % y F1 de áreas 0,390 frente a jev (4 incidencias idénticas): no llega a ningún umbral de calidad, y con áreas por debajo de 0,50 la eficiencia no cuenta. Fue el más barato (57 s, 8 peticiones, 247 k tokens, ≈ 0,007 $), pero la clasificación no sirve. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**TCI**

- Hace cat del fichero entero y lista títulos y 180 caracteres de cada incidencia, pero no clasifica lo que lee: escribe un clasificador de expresiones regulares por palabras clave (windows|powershell|wsl…, sandbox|permission|approval…) y lo aplica a las 300.
- Las reglas marcan áreas de más en casi todas: 183 falsos model-behavior, 199 session, 135 auth y 123 performance.
- Lo primero que busca es un AGENTS.md en la carpeta.
- Solo comprueba la forma del resultado (300 ids únicos, valores permitidos), no si la clasificación tiene sentido.
