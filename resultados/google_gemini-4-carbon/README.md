# google/gemini-4-carbon

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 9,2 / 10** (4 de 4 prompts juzgados). Total: 48 peticiones y 1611,8 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio |
|---|---|---:|---:|---:|---|---|
| [A3D](A3D/juicio.md) | visual | 4 | 111,2 k | 9 | se recorre y se reconoce | Una maqueta con three.js de ocho paradas, de la Puerta de la Justicia al Generalife, con ruta guiada que lleva la cámara por una curva luminosa, fichas históricas correctas y luz de atardecer, día y noche. Se reconocen el arco de la Justicia, el patio circular de Carlos V, la alberca de Arrayanes y los cipreses, pero en los Leones los tejados tapan el patio. |
| [AIF](AIF/juicio.md) | visual | 16 | 642,7 k | 10 | el AIF más completo | Mesa libre donde se suelta una ficha sobre otra, 112 elementos y 389 recetas todos alcanzables desde cuatro iniciales (Código, Micrófono, Café, Curiosidad), un generador para las mezclas sin receta, pistas, buscador, códice, logros y guardado. El contenido es de Web Reactiva de verdad (malandriner, Daniel Primo, Zona Premium, Telegram, café virtual, mastermind), aunque sacado de memoria porque la búsqueda web se canceló. |
| [CCA](CCA/juicio.md) | código | 25 | 835,4 k | 9 | escala en una máquina | TypeScript sobre Node 22 sin dependencias, hexagonal, con dinero en céntimos, precio del catálogo, cupones, IVA, envío, idempotencia, checkout con reserva de stock y SQLite en WAL con compare-and-set por versión: 50 altas a la vez no pierden nada, ni repartidas entre dos instancias con el mismo fichero. Pero cada instancia guarda una caché L1 que sirve lecturas viejas cuando escribe la otra, y el stock y la idempotencia viven en memoria de cada proceso. |
| [PTS](PTS/juicio.md) | texto | 3 | 22,5 k | 9 | completo, con tics de formato | Defiende bien la tesis (no tener tests es una incertidumbre honesta; un test intermitente da permiso para ignorar la prueba) con un ejemplo de código antes y después y una cifra correcta sobre colas de merge. Pierde un punto por el formato de blog generado: dieciocho negritas, listas con etiqueta, emojis y una sección «Conclusión». |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché).

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

**PTS**

- Mira la carpeta, escribe el post y contesta: tres peticiones y 0,05 $
