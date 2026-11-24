# google/gemini-4-hydrogen

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 8,7 / 10** (3 de 5 prompts juzgados). Total: 37 peticiones y 1304,1 k tokens.

Pendientes: SEC, TCI.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 7 | 220,3 k | 9 | a pie de calle, tapado | Ruta guiada a pie de calle por ocho paradas con three.js, que arranca sola y además se puede explorar en órbita o a pie con WASD; se reconocen la fuente de los Leones, la alberca de Arrayanes, el patio circular de Carlos V y la acequia del Generalife. Pero unos marcadores numerados enormes tapan media pantalla en cada parada y en el Salón de Embajadores la cámara queda contra un muro. | [▶ alhambra-ruta-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/google_gemini-4-hydrogen/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 8 | 405,4 k | 9 | de la casa, sin infinito | Mesa libre donde se suelta una ficha sobre otra, 109 elementos y 255 recetas todos alcanzables desde Código, Web, IA y Podcast, con pista de Robotito, buscador, Atlas Malandriner con rangos y guardado. El contenido sale de webreactiva.com (Robotito, Zona Premium, En Pantuflas, Atlas Malandriner, Programa con IA), pero las mezclas sin receta no dan nada. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/google_gemini-4-hydrogen/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 22 | 678,4 k | 8 | bien hecho, poca concurrencia | Librería TypeScript sin dependencias, hexagonal, con dinero en céntimos, precio del catálogo, promociones (porcentaje, fijo, 3x2, volumen), IVA por categoría, envío, idempotencia, fusión de carritos y checkout con compensación de stock; 14 tests y una demo que funcionan. La versión optimista no pierde datos, pero con 50 altas a la vez rechaza 45 porque reintenta cinco veces sin esperar, y solo hay adaptadores en memoria. | – |

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

**CCA**

- Un test de concurrencia falló (13/14) y lo arregló subiendo los reintentos por defecto de 3 a 5: ajustó un parámetro hasta que el test pasó.
- Entrega la carpeta dist/ compilada junto al código.
- 22 peticiones, 678 000 tokens, 0,43 $.
