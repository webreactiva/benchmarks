# gpt-6-luna (medium)

Agente: Codex CLI. Fechas: 2026-11-24 a 2026-11-24.

**Nota media: 2,3 / 10** (3 de 5 prompts juzgados). Total: 22 peticiones y 573,6 k tokens.

Pendientes: AIF, CCA.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 3 | 49,0 k | 5 | panel bonito, cámara quieta | Un canvas 2D con perspectiva a mano: un recinto amurallado de cajas con almenas, un estanque en el centro, cipreses y una franja de sierra al fondo, con cinco paradas en orden (Justicia, Carlos V, Arrayanes, Leones, Generalife) unidas por una línea de puntos. «Iniciar recorrido» y «Siguiente parada» solo cambian la parada resaltada: la cámara no viaja, solo se gira a mano, y la cita del pie se monta encima de los botones. | [▶ ruta-alhambra-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6-luna-medium/A3D/salida/ruta-alhambra-3d.html) |
| [SEC](SEC/juicio.md) | seguridad | 11 | 277,6 k | 2 | Preciso, pero sin inyecciones | Informe de 13 hallazgos, 12 con fichero y línea, sin CWE y ninguno inventado: cubre 13 de las 40 entradas con la regla estricta (5 sin línea, a medio punto: 10,5 en la nota, F3 28,2), 15 con el criterio del juez. No ve ninguna SQLi ni XSS, ni las SSRF, el open redirect, las flags, el diag o las credenciales del seed. | – |
| [TCI](TCI/juicio.md) | clasificación | 8 | 247,0 k | 0 | Regex en vez de leer | Tipo 90,0 %, superficie 75,3 % y F1 de áreas 0,390 frente a jev (4 incidencias idénticas): no llega a ningún umbral de calidad, y con áreas por debajo de 0,50 la eficiencia no cuenta. Fue el más barato (57 s, 8 peticiones, 247 k tokens, ≈ 0,007 $), pero la clasificación no sirve. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Lo hace en un solo paso: escribe los 9,6 KB del HTML de una vez y no lo abre ni lo prueba. 3 peticiones, 49 000 tokens, 3944 de salida.
- Dice en el chat que es una «escena 3D estilizada e interactiva»: es un canvas 2D con una proyección en perspectiva hecha a mano, sin WebGL ni three.js.
- Los subtítulos de las paradas no visitadas son de relleno: las dos primeras dicen «Alcazaba y palacios» y las otras tres «Recinto monumental».

**SEC**

- No busca SQL ni HTML: su única búsqueda por patrones (withAuth, password, readFile, exec, dangerouslySetInnerHTML…) no incluye queryRaw, y se le escapan las cinco SQLi y las dos XSS.
- Sale a internet sin búsqueda web: npm audit --omit=dev contra el registro de npm. No nombra el proyecto original.
- Lo primero que busca es un AGENTS.md. No toca el código: escribe SECURITY_AUDIT.md con apply_patch.
- 11 peticiones y 278 k tokens.

**TCI**

- Hace cat del fichero entero y lista títulos y 180 caracteres de cada incidencia, pero no clasifica lo que lee: escribe un clasificador de expresiones regulares por palabras clave (windows|powershell|wsl…, sandbox|permission|approval…) y lo aplica a las 300.
- Las reglas marcan áreas de más en casi todas: 183 falsos model-behavior, 199 session, 135 auth y 123 performance.
- Lo primero que busca es un AGENTS.md en la carpeta.
- Solo comprueba la forma del resultado (300 ids únicos, valores permitidos), no si la clasificación tiene sentido.
