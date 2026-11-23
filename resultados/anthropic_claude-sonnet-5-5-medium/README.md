# claude-sonnet-5-5 (medium)

Agente: Claude Code. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 8,3 / 10** (3 de 4 prompts juzgados). Total: 26 peticiones y 2972,7 k tokens.

Pendientes: SEC.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 19 | 2661,8 k | 9 | se pasea dentro, encuadres flojos | Una maqueta con three.js que se recorre a pie a la altura de los ojos por 9 paradas en orden de visita, y se reconoce: Puerta de la Justicia con la llave, Alcazaba, patio circular de Carlos V, fuente de los doce leones con sus canales, Comares y la acequia del Generalife con surtidores. Pero en la vista Paseo, que es la del recorrido, varias paradas encuadran un muro: el Mexuar es un panel de azulejos a un palmo, en Arrayanes no se ve el estanque y el mirador final mira a una muralla. | [▶ alhambra_ruta_3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/anthropic_claude-sonnet-5-5-medium/A3D/salida/alhambra_ruta_3d.html) |
| [AIF](AIF/juicio.md) | visual | 4 | 186,7 k | 7 | buen juego, otra Web Reactiva | Mesa libre donde se suelta una ficha sobre otra, 63 elementos y 59 recetas, todos alcanzables desde Estado, Evento, Píxel y Pantalla, con buscador y guardado de la mesa. Pero leyó «Web Reactiva» como programación reactiva más diseño responsive (señales, Virtual DOM, media queries, clamp()): de la web, el podcast o la comunidad no hay nada, y las mezclas sin receta no dan nada. | [▶ alquimia-web-reactiva.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/anthropic_claude-sonnet-5-5-medium/AIF/salida/alquimia-web-reactiva.html) |
| [CCA](CCA/juicio.md) | código | 3 | 124,3 k | 9 | escala en 400 líneas | Python sin dependencias con servicio sin estado, versión optimista con reintentos y un adaptador de Redis con compare-and-swap en Lua y TTL que funciona: con dos instancias sobre el mismo Redis, 50 altas a la vez acaban guardadas o en un 409 explícito, sin pérdidas. Pero el carrito que devuelve se puede mutar y en memoria eso cambia lo guardado (500 unidades a 1 céntimo sin pasar por el catálogo), solo hay una moneda fija y el adaptador de Redis no lo probó ni lo conectó a la API. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Se comprobó a sí mismo: descargó three.js a su scratchpad para probar sin red, sacó capturas con Chrome headless (SwiftShader) inyectando JavaScript en copias del HTML y leyó 15 capturas; corrigió la cornisa de Carlos V que tapaba el patio, el arbolado y la cámara de la primera parada.
- Dejó en el HTML final el gancho de pruebas que se fabricó para esas capturas (`window.__alhambra` con `setMode`, `gotoStop` y la órbita).
- 2,66 M tokens en 19 peticiones (102 k de salida, 2,43 M leídos de caché): casi el triple que Haiku en este prompt (981 k en 11).
- Corrió sin encierro; no leyó nada fuera de su carpeta de trabajo y su scratchpad (`scripts/fugas.py` limpio).

**AIF**

- Tenía WebSearch y WebFetch y no los usó: decidió qué era «Web Reactiva» por el nombre y lo dice en el chat («puede significar programación reactiva o diseño responsive, así que usé los dos»).
- Termina pidiendo lo que no puede pedir: «Si te referías a una web o curso concreto, dime qué temas incluye y adapto los elementos».
- Comprobó con un script de Python que todo es alcanzable y avisa de que no lo abrió en un navegador; en el chat habla de «63 recetas» y son 59 (63 son los elementos).
- 4 peticiones, 187 k tokens y 0,30 $ en menos de dos minutos.

**CCA**

- 3 peticiones, 124 k tokens, 72 s y 0,16 $: escribió todo de una vez en un único heredoc, pasó los tests a la primera y ni los tocó.
- Dice con claridad lo que no ha probado (Redis y la API HTTP), y es lo que mejor funciona en las pruebas del juez.
- El test de concurrencia que cita en la respuesta lanza 6 hilos, no 50.
- Al acabar, Claude Code dejó escrita en la caja de entrada la sugerencia «añade la idempotencia con Idempotency-Key»; no se envió (un solo mensaje en la sesión).
- Dejó __pycache__ en la entrega.
