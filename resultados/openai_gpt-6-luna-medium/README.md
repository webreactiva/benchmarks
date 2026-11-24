# gpt-6-luna (medium)

Agente: Codex CLI. Fechas: 2026-11-24 a 2026-11-24.

**Nota media: 1,0 / 10** (2 de 5 prompts juzgados). Total: 19 peticiones y 524,6 k tokens.

Pendientes: A3D, AIF, CCA.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [SEC](SEC/juicio.md) | seguridad | 11 | 277,6 k | 2 | Preciso, pero sin inyecciones | Informe de 13 hallazgos, 12 con fichero y línea, sin CWE y ninguno inventado: cubre 13 de las 40 entradas con la regla estricta (5 sin línea, a medio punto: 10,5 en la nota, F3 28,2), 15 con el criterio del juez. No ve ninguna SQLi ni XSS, ni las SSRF, el open redirect, las flags, el diag o las credenciales del seed. | – |
| [TCI](TCI/juicio.md) | clasificación | 8 | 247,0 k | 0 | Regex en vez de leer | Tipo 90,0 %, superficie 75,3 % y F1 de áreas 0,390 frente a jev (4 incidencias idénticas): no llega a ningún umbral de calidad, y con áreas por debajo de 0,50 la eficiencia no cuenta. Fue el más barato (57 s, 8 peticiones, 247 k tokens, ≈ 0,007 $), pero la clasificación no sirve. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**SEC**

- No busca SQL ni HTML: su única búsqueda por patrones (withAuth, password, readFile, exec, dangerouslySetInnerHTML…) no incluye queryRaw, y se le escapan las cinco SQLi y las dos XSS.
- Copia en el informe las credenciales del SIEM (root:admin) y el valor de la cookie; las demás auditorías las omitieron.
- Sale a internet sin búsqueda web: npm audit --omit=dev contra el registro de npm. No nombra el proyecto original.
- Lo primero que busca es un AGENTS.md. No toca el código: escribe SECURITY_AUDIT.md con apply_patch.
- 11 peticiones y 278 k tokens.

**TCI**

- Hace cat del fichero entero y lista títulos y 180 caracteres de cada incidencia, pero no clasifica lo que lee: escribe un clasificador de expresiones regulares por palabras clave (windows|powershell|wsl…, sandbox|permission|approval…) y lo aplica a las 300.
- Las reglas marcan áreas de más en casi todas: 183 falsos model-behavior, 199 session, 135 auth y 123 performance.
- Lo primero que busca es un AGENTS.md en la carpeta.
- Solo comprueba la forma del resultado (300 ids únicos, valores permitidos), no si la clasificación tiene sentido.
