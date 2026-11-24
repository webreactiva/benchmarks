# claude-sonnet-5-5 (medium)

Agente: Claude Code. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 7,4 / 10** (5 de 5 prompts juzgados). Total: 48 peticiones y 4550,1 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 19 | 2661,8 k | 9 | se pasea dentro, encuadres flojos | Una maqueta con three.js que se recorre a pie a la altura de los ojos por 9 paradas en orden de visita, y se reconoce: Puerta de la Justicia con la llave, Alcazaba, patio circular de Carlos V, fuente de los doce leones con sus canales, Comares y la acequia del Generalife con surtidores. Pero en la vista Paseo, que es la del recorrido, varias paradas encuadran un muro: el Mexuar es un panel de azulejos a un palmo, en Arrayanes no se ve el estanque y el mirador final mira a una muralla. | [▶ alhambra_ruta_3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/anthropic_claude-sonnet-5-5-medium/A3D/salida/alhambra_ruta_3d.html) |
| [AIF](AIF/juicio.md) | visual | 4 | 186,7 k | 7 | buen juego, otra Web Reactiva | Mesa libre donde se suelta una ficha sobre otra, 63 elementos y 59 recetas, todos alcanzables desde Estado, Evento, Píxel y Pantalla, con buscador y guardado de la mesa. Pero leyó «Web Reactiva» como programación reactiva más diseño responsive (señales, Virtual DOM, media queries, clamp()): de la web, el podcast o la comunidad no hay nada, y las mezclas sin receta no dan nada. | [▶ alquimia-web-reactiva.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/anthropic_claude-sonnet-5-5-medium/AIF/salida/alquimia-web-reactiva.html) |
| [CCA](CCA/juicio.md) | código | 3 | 124,3 k | 9 | escala en 400 líneas | Python sin dependencias con servicio sin estado, versión optimista con reintentos y un adaptador de Redis con compare-and-swap en Lua y TTL que funciona: con dos instancias sobre el mismo Redis, 50 altas a la vez acaban guardadas o en un 409 explícito, sin pérdidas. Pero el carrito que devuelve se puede mutar y en memoria eso cambia lo guardado (500 unidades a 1 céntimo sin pasar por el catálogo), solo hay una moneda fija y el adaptador de Redis no lo probó ni lo conectó a la API. | – |
| [SEC](SEC/juicio.md) | seguridad | 13 | 1004,3 k | 4 | Ve casi todo, sin líneas | Informe de 29 hallazgos agrupados en el que el juez reconoce 33 de las 40 entradas y solo seis no se sostienen, pero la nota cuenta 16 (F3 40,9) porque solo da una línea en todo el informe y cada acierto sin línea vale medio. Se le escapan la fuga de la URL interna del asistente, el token de soporte en claro y en la respuesta, el open redirect del LoginForm, el XSS de reseñas y la página de noticias; no da ningún CWE. | – |
| [TCI](TCI/juicio.md) | clasificación | 9 | 573,1 k | 8 | El más rápido, superficie justa | Tipo 96,3 %, superficie 84,3 % y F1 de áreas 0,628 frente a jev (78 incidencias idénticas). Le costó 69 s, 9 peticiones y 573 k tokens (≈ 0,29 $). | – |

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

**SEC**

- Dice que el proyecto parece «una aplicación deliberadamente vulnerable» por flag.txt, las flags QKB{…} y la tabla Flag; no nombra el proyecto original y enmascara los valores de los secretos en el informe.
- Sale a internet una vez: ejecuta npm audit --omit=dev, que consulta el registro de npm (WebSearch y WebFetch estaban denegados, pero el registro es accesible). De ahí salen los 21 avisos y las versiones de C4; los CVE de Next y React los nombra de memoria y avisa de que hay que verificarlos.
- Sesión corta: 13 comandos de shell que leen los ficheros a bloques con cat y grep, y un Write; sin subagentes ni compactaciones, termina en 1 min 41 s. Un comando lo rechaza el clasificador del modo auto (por el cd previo) y lo repite.
- Solo da línea en un hallazgo (AnalyticsClient.tsx:366) y ningún CWE: 30 de sus 31 aciertos valen medio punto.
- No toca el código: solo crea SECURITY_AUDIT.md. La pantalla deja sugerido «Corrige los hallazgos críticos», que no se llegó a enviar.

**TCI**

- Clasifica «a mano» leyendo el título y los primeros 110-260 caracteres de cada incidencia, en bloques de 60, y luego escribe el resultado con un script que comprueba que están las 300.
- Pone los avisos de «Selected model is at capacity» en connectivity (jev, en rate-limits) y lo dice en su respuesta.
- Es el que menos tokens de salida gasta (10 k) y el más rápido (69 s).
