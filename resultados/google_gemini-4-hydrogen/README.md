# google/gemini-4-hydrogen

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 7,6 / 10** (5 de 5 prompts juzgados). Total: 84 peticiones y 7573,3 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 7 | 220,3 k | 7 | a pie de calle, tapado | Ruta guiada a pie de calle por ocho paradas con three.js, que arranca sola y además se puede explorar en órbita o a pie con WASD; se reconocen la fuente de los Leones, la alberca de Arrayanes, el patio circular de Carlos V y la acequia del Generalife. Pero unos marcadores numerados enormes tapan media pantalla en cada parada y en el Salón de Embajadores la cámara queda contra un muro. | [▶ alhambra-ruta-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/google_gemini-4-hydrogen/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 8 | 405,4 k | 9 | de la casa, sin infinito | Mesa libre donde se suelta una ficha sobre otra, 109 elementos y 255 recetas todos alcanzables desde Código, Web, IA y Podcast, con pista de Robotito, buscador, Atlas Malandriner con rangos y guardado. El contenido sale de webreactiva.com (Robotito, Zona Premium, En Pantuflas, Atlas Malandriner, Programa con IA), pero las mezclas sin receta no dan nada. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/google_gemini-4-hydrogen/AIF/salida/index.html) |
| [SEC](SEC/juicio.md) | seguridad | 21 | 2819,6 k | 8 | Cobertura casi total, líneas anchas | Informe de 26 hallazgos agrupados, todos con fichero, línea y CWE, sin un solo fallo inventado: cubre 36 de las 40 entradas con el criterio del juez, incluido el oráculo de padding. La nota se queda en F3 63,9 porque 18 de esas entradas las señala con rangos de más de 20 líneas, que valen medio acierto. | – |
| [CCA](CCA/juicio.md) | código | 22 | 678,4 k | 8 | bien hecho, poca concurrencia | Librería TypeScript sin dependencias, hexagonal, con dinero en céntimos, precio del catálogo, promociones (porcentaje, fijo, 3x2, volumen), IVA por categoría, envío, idempotencia, fusión de carritos y checkout con compensación de stock; 14 tests y una demo que funcionan. La versión optimista no pierde datos, pero con 50 altas a la vez rechaza 45 porque reintenta cinco veces sin esperar, y solo hay adaptadores en memoria. | – |
| [TCI](TCI/juicio.md) | clasificación | 26 | 3449,6 k | 6 | El mejor en áreas, caro | Tipo 96,7 %, superficie 88,0 % y F1 de áreas 0,725 frente a jev (91 idénticas): el F1 de áreas más alto de todos. Le costó 261 s, 26 peticiones y 3,45 M tokens (0,99 $ en OpenRouter), así que no suma eficiencia. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Lo probó en Chrome con Playwright: arrancó la página, saltó a las paradas 4 y 6 y comprobó los títulos antes de dar por terminado.
- Comprobó con curl que el CDN de three.js respondía antes de usarlo.
- 7 peticiones, 220 000 tokens, 0,43 $.

**AIF**

- La primera búsqueda web quedó cancelada por el permiso de OpenCode (el lanzador contestó «Decide tú.»); volvió a buscar, esta vez pasó, y leyó la portada de webreactiva.com con webfetch.
- Se comprobó con node: recetas duplicadas (8), las quitó y verificó 109/109 alcanzables.
- 8 peticiones, 405 000 tokens, 0,47 $: la mitad de peticiones y de coste que Carbon en el mismo prompt.

**SEC**

- Ve que el proyecto «parece un campo de entrenamiento de seguridad» (lo dice en su razonamiento, por flag.txt y las librerías); en el informe no lo menciona ni nombra el proyecto original.
- No sale a internet: solo lee ficheros (135 lecturas, 6 glob, 3 grep, 3 shell con cat/nl). Los CVE de Next los cita de memoria.
- Cita en el informe una flag QKB{…} del prompt del sistema como secreto expuesto.
- Agrupa mucho: 26 hallazgos con varias ubicaciones cada uno, a menudo con rangos de más de 20 líneas, que la regla cuenta como sin línea.
- No toca el código: solo crea AUDITORIA_SEGURIDAD.md. Sesión sin errores, 3 min 47 s, 0,76 $.

**CCA**

- Un test de concurrencia falló (13/14) y lo arregló subiendo los reintentos por defecto de 3 a 5: ajustó un parámetro hasta que el test pasó.
- Entrega la carpeta dist/ compilada junto al código.
- 22 peticiones, 678 000 tokens, 0,43 $.

**TCI**

- Leyó las 300 incidencias por trozos con read y shell, y escribió el resultado con un script de Python.
- OpenRouter por Google AI Studio con SALIDA_MAX=65536, sin un solo corte.
