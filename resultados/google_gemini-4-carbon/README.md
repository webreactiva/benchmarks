# google/gemini-4-carbon

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 8,4 / 10** (5 de 5 prompts juzgados). Total: 105 peticiones y 7550,3 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 4 | 111,2 k | 9 | se recorre y se reconoce | Una maqueta con three.js de ocho paradas, de la Puerta de la Justicia al Generalife, con ruta guiada que lleva la cámara por una curva luminosa, fichas históricas correctas y luz de atardecer, día y noche. Se reconocen el arco de la Justicia, el patio circular de Carlos V, la alberca de Arrayanes y los cipreses, pero en los Leones los tejados tapan el patio. | [▶ alhambra-ruta-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/google_gemini-4-carbon/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 16 | 642,7 k | 10 | el AIF más completo | Mesa libre donde se suelta una ficha sobre otra, 112 elementos y 389 recetas todos alcanzables desde cuatro iniciales (Código, Micrófono, Café, Curiosidad), un generador para las mezclas sin receta, pistas, buscador, códice, logros y guardado. El contenido es de Web Reactiva de verdad (malandriner, Daniel Primo, Zona Premium, Telegram, café virtual, mastermind), aunque sacado de memoria porque la búsqueda web se canceló. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/google_gemini-4-carbon/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 25 | 835,4 k | 9 | escala en una máquina | TypeScript sobre Node 22 sin dependencias, hexagonal, con dinero en céntimos, precio del catálogo, cupones, IVA, envío, idempotencia, checkout con reserva de stock y SQLite en WAL con compare-and-set por versión: 50 altas a la vez no pierden nada, ni repartidas entre dos instancias con el mismo fichero. Pero cada instancia guarda una caché L1 que sirve lecturas viejas cuando escribe la otra, y el stock y la idempotencia viven en memoria de cada proceso. | – |
| [SEC](SEC/juicio.md) | seguridad | 20 | 2141,9 k | 8 | Auditoría completa y precisa | Informe de 22 hallazgos agrupados, todos con fichero, línea y CWE: cubre 31 de las 40 entradas con la regla estricta (8 sin línea, a medio punto: 27 en la nota, F3 68,5), 37 con el criterio del juez, y no inventa ninguno. Se le escapan la fuga de la URL de las herramientas del asistente, el logout que no invalida la sesión y las credenciales del seed; los rangos anchos le cuestan medio punto en ocho entradas. | – |
| [TCI](TCI/juicio.md) | clasificación | 40 | 3819,1 k | 6 | Bien clasificado, caro | Leyó las 300 incidencias en trozos y las clasificó en una sola petición larga. Le costó 1059 s, 40 peticiones, 3,82 M tokens y 1,28 $ en OpenRouter, así que no suma eficiencia. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Un solo write con el HTML entero (75 KB) y una comprobación de sintaxis con node: 4 peticiones, 111 000 tokens, 0,38 $.
- No lo abrió en un navegador; solo comprobó que el JavaScript parseaba.
- Primera tirada perdida: la ruta por defecto de OpenRouter (Google Vertex) cortaba cada petición con un 502 a los ~5 min de razonar (en _descartados/).

**AIF**

- Intentó una búsqueda web sobre Web Reactiva; OpenCode pidió permiso, el lanzador cerró el diálogo y le contestó «Decide tú.», y siguió sin buscar.
- Escribió un esqueleto y lo rellenó por secciones con 7 edit; se comprobó a sí mismo con node: ids inexistentes en las recetas, pares en conflicto y alcanzabilidad (112/112), y corrigió lo que salió.
- 16 peticiones, 643 000 tokens (475 000 de caché), 1,09 $.
- Primera tirada perdida: por la ruta por defecto de OpenRouter (Google Vertex) la petición que escribía el juego se cortó tres veces con un 502 (en _descartados/); esta fue por Google AI Studio.

**CCA**

- Preguntó con la herramienta de preguntas qué tipo de solución hacía (API, full-stack, módulo); el lanzador la cerró y siguió con su opción recomendada.
- Comprobó qué había en la máquina (node, npm, python, go, la versión de SQLite de Node) antes de elegir y se quedó con lo que traía Node 22: cero dependencias.
- El primer npm test dio 8/9; arregló el servicio, no el test.
- El README presenta los nodos como «sin estado» y la L1 como «reemplazable por Redis»: en la práctica cada nodo guarda caché, stock e idempotencia propios.
- 25 peticiones, 835 000 tokens (694 000 de caché), 0,72 $.

**SEC**

- Dice que el pie de página describe el proyecto como plataforma educativa de seguridad; no nombra el proyecto original.
- No sale a internet (webfetch y websearch denegados; no lo intenta): cita CVE-2025-55182 a partir del nombre de una flag de .env.local y CVE-2025-29927 de memoria.
- Solo dos órdenes de shell (cat de dos ficheros que ya podía leer con read) y 134 lecturas; un glob falla por buscar una carpeta components que no existe.
- No toca el código: solo crea AUDITORIA_SEGURIDAD.md.
- Agrupa mucho: 22 hallazgos que reúnen varios fallos cada uno, con rangos de línea anchos que en 8 entradas dejan el acierto a medio punto.

**TCI**

- Leyó las incidencias con read en trozos de ~50 KB y consultó algunas sueltas con scripts de Python.
- Varias peticiones cortadas por el proveedor (Google AI Studio por OpenRouter); no se cobraron.
