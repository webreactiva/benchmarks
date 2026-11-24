# ollama/kimi-k3.1-pro

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 7,8 / 10** (5 de 5 prompts juzgados). Total: 107 peticiones y 6801,1 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 23 | 1008,0 k | 10 | el mejor A3D, sin librerías | Una maqueta 3D con motor propio, sin three.js ni nada externo, que se reconoce (murallas almenadas, Alcazaba, Carlos V con su patio circular, los patios nazaríes con su fuente, el Generalife entre cipreses) y un recorrido de 6 paradas que lleva la cámara de una a otra sin atravesar nada. Diseño de guía turística: itinerario con tiempos, fichas, plano, atardecer, historia y consejos. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_kimi-k3.1-pro/A3D/salida/index.html) |
| [AIF](AIF/juicio.md) | visual | 25 | 1714,8 k | 9 | pulido y de Web Reactiva | Contenido sacado de cuatro páginas de webreactiva.com (Malandriner, En pantuflas, Claude Code, Skills, MCP, SDD, «Deploy en viernes»), 98 elementos todos alcanzables, rangos («Aprendiz en pantuflas»), hitos, pistas, bitácora y una interfaz de producto. Mesa libre donde se combina soltando una ficha sobre otra. No es infinito: las mezclas sin receta dan un mensaje. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_kimi-k3.1-pro/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 11 | 174,6 k | 6 | correcto, pero no escala | Una clase Carrito en Python, limpia y bien validada (Decimal, una moneda por carrito, precio y stock del catálogo, 17 tests), pero sin servicio, sin persistencia y sin nada que responda a «escalable»: el carrito vive en un objeto en memoria y no hay README que lo explique. | – |
| [SEC](SEC/juicio.md) | seguridad | 34 | 3651,5 k | 8 | Amplio, preciso, rangos anchos | Informe de 34 hallazgos sin ninguno inventado en el que el juez reconoce 35 de las 40 entradas, pero la nota cuenta 25,5 (F3 64,3): trece rangos pasan de 20 líneas y 17 entradas valen medio acierto. Se le escapan la SSRF del asistente (la borró justo antes del corte), la fuga de herramientas en su respuesta, la enumeración en el login, el oráculo de padding y el token de soporte en claro. | – |
| [TCI](TCI/juicio.md) | clasificación | 14 | 252,2 k | 6 | El que mejor clasifica, el más caro | Repartió las incidencias entre 10 subagentes que leen el texto completo de cada una. Es el que más se parece a jev (áreas F1 0,712, superficie 89 %), pero gasta 2,4 M de tokens, 117 peticiones y ≈ 1,23 $: calidad 6/6 y eficiencia 0/4. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- El único A3D sin librerías: ni three.js ni CDN, funciona sin conexión.
- Organizó el trabajo con una lista de tareas (todowrite) y lo probó en varias resoluciones.
- 23 peticiones y 1 millón de tokens.

**AIF**

- 5 lecturas web, una de ellas el logo de la web (que luego no usó: dibujó el suyo).
- Recorrió las 94 combinaciones en Chrome para comprobar el juego entero.
- 25 peticiones y 1,7 millones de tokens.

**CCA**

- El más corto de todos los CCA: 11 peticiones y 175 k tokens. Entiende «escalable» como catálogo inyectable.
- Dejó __pycache__ en la entrega.

**SEC**

- Cortado por el límite de uso de Ollama Cloud (429, provider.quota) a los 11 min 17 s, en una segunda pasada con el informe ya escrito. Se juzga tal cual por decisión del autor (meta.json: error y nota_del_autor).
- Su última edición antes del corte borró M-02 (SSRF por mcpServerUrl en ai-assistant:63-99, que habría cubierto la entrada 008 como medio acierto) para subirla de severidad, y no llegó a reinsertarla: el informe se queda sin la SSRF del asistente y el resumen sigue anunciando 36 grupos (12 medios) cuando hay 34 (10 medios).
- Ejecuta dos veces npm audit --package-lock-only, que consulta el registro de npm: es la única salida a la red; sin curl, git ni webfetch. Los GHSA de Next.js salen de ese audit, no de memoria. npm pack --dry-run es local. Deja los JSON de ambos en salida/; no son hallazgos por sí mismos y se juzgan solo a través de C-09.
- Lo llama «laboratorio vulnerable» por las flags; no nombra el proyecto original ni copia los valores de flags, claves o contraseñas al informe.
- Reparte la revisión en tres subagentes (autenticación, inyección, configuración) y 136 lecturas; cinco edit sobre su propio informe. No toca el código del proyecto.
- Da fichero y línea en los 34 hallazgos y CWE en 33 (C-09 pone «múltiples»), pero trece ubicaciones son rangos de más de 20 líneas (51-91, 81-103, 102-143, 8-67, 8-64, 6-37, 6-31, 95-135, 253-319, 47-85, 6-81, 5-25, 15-43): las 16 entradas que cubren valen medio acierto, y .env.local sin línea, otra más.

**TCI**

- Escribió unas instrucciones de clasificación propias (.instrucciones_clasificacion.md) y lanzó 10 subagentes de 30 incidencias cada uno.
- Los 10 subagentes gastaron 2,2 M de los 2,4 M de tokens; lanzar.sh solo apuntó los 252 k del agente principal.
