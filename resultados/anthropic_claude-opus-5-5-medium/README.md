# claude-opus-5-5 (medium)

Agente: Claude Code. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 8,8 / 10** (4 de 5 prompts juzgados). Total: 65 peticiones y 5731,9 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 17 | 2281,3 k | 9 | la maqueta más vistosa | Una Alhambra con three.js a media tarde que se reconoce de un vistazo (Sierra Nevada nevada, Alcazaba con la Torre de la Vela, patio circular de Carlos V, alberca de Arrayanes con su pórtico, Leones con galerías y templetes, Partal, acequia del Generalife con arcos de agua) y un recorrido de 8 paradas que arranca solo y lleva la cámara en vuelo de una a otra. Pero a 1280×800 la ficha de la parada tapa el final de la lista (la parada 8 no se puede pulsar) y un cuarto de la escena, y en la vista final las etiquetas se montan. | [▶ alhambra-ruta-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/anthropic_claude-opus-5-5-medium/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 4 | 244,6 k | 8 | gran juego, Web Reactiva a medias | Mesa libre donde se suelta una ficha sobre otra, 178 elementos y 181 recetas, todos alcanzables desde Código, Café, Idea y Bug, con pistas, buscador, guardado y cinco objetivos con candado. De Web Reactiva tiene la capa de marca de memoria (Podcast, Newsletter, Dani Primo, Malandriner, Premium), unos 20 elementos; el resto es cultura de programador genérica, y las mezclas sin receta solo dan un chiste. | [▶ alquimia-reactiva.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/anthropic_claude-opus-5-5-medium/AIF/salida/alquimia-reactiva.html) |
| [CCA](CCA/juicio.md) | código | 13 | 725,9 k | 10 | escala, y Redis funciona | Servicio REST en Node sin dependencias, hexagonal, con carrito inmutable, céntimos, precios del catálogo, versión optimista con reintentos y backoff, y un adaptador de Redis con compare-and-swap en Lua que se conecta con REDIS_URL y aguanta 50 altas a la vez desde dos instancias sin perder nada. Lo flojo es menor: la moneda la pone el cliente sin validar, ioredis no está en package.json y la idempotencia y el catálogo solo existen en memoria, cosa que el README admite. | – |
| [SEC](SEC/juicio.md) | seguridad | 19 | 1712,1 k | – | sin juzgar |  | – |
| [TCI](TCI/juicio.md) | clasificación | 12 | 768,0 k | 8 | Mejor en áreas, caro | Tipo 97,0 %, superficie 87,7 % y F1 de áreas 0,668 frente a jev (86 incidencias idénticas). Le costó 125 s, 12 peticiones y 768 k tokens (≈ 0,79 $). | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Se comprobó a sí mismo con Chrome headless (SwiftShader): la primera captura salió negra, inyectó un registro de errores en una copia del HTML, encontró que el mapa de entorno (PMREM) rompía el render y lo quitó; luego miró capturas de las ocho paradas y reencuadró Arrayanes, Leones y el Partal.
- Cuenta con precisión lo que no probó: «Las capturas son fotogramas fijos: no he visto la animación en movimiento… Tampoco he probado la vista libre ni el diseño para pantallas pequeñas». El fallo de la ficha sobre la lista está justo ahí.
- 2,28 M tokens en 17 peticiones (93 k de salida, 2,07 M leídos de caché); algo menos que Sonnet.
- Termina ofreciendo publicarlo como página web con un enlace.
- Corrió sin encierro; no leyó nada fuera de su carpeta de trabajo y su scratchpad (`scripts/fugas.py` limpio).

**AIF**

- Tenía WebSearch y WebFetch y no los usó: Dani Primo, Malandriner y la comunidad salen de memoria, sin un tema actual de la web (agentes, MCP, En pantuflas).
- Mete a Dani Primo como elemento y avisa al final de que quizá convenga «confirmar que le parece bien».
- Comprobó con node que no hay recetas duplicadas, que se llega a los 178 elementos y que el JavaScript compila, y dice que no lo probó en un navegador.
- 4 peticiones, 245 k tokens y 0,99 $, el triple que Sonnet en la misma prueba.

**CCA**

- 13 peticiones, 726 k tokens (650 k de caché) y 4 min 25 s: escribió el código fichero a fichero y lo probó con tests y con curl.
- Su test de 50 altas a la vez falló (cantidad 1) y lo arregló en el código: el save en memoria tenía un await entre comprobar la versión y escribir. El test no lo tocó; lo único que cambió para que corrieran fue el glob de npm test.
- Dice que el adaptador de Redis no lo ha probado contra un Redis real; en las pruebas del juez es lo que mejor sale.
- Sin encierro: escribió el log del servidor en /tmp/claude-0/srv.log, fuera de su carpeta, y lo paró con pkill -f "node src/index.js", que mata cualquier proceso con ese nombre en la máquina. scripts/fugas.py no encuentra lecturas fuera de /var/tmp/bench/ws-FvdIqxPx.
- Al acabar, Claude Code dejó en la caja de entrada la sugerencia «Implementa la idempotencia con Redis para varias réplicas»; no se envió.

**TCI**

- Resume cada incidencia en unos 450 caracteres con un script y abre completas cinco dudosas.
- Escribe la clasificación en un formato abreviado (51098|b|CLI|…) y la convierte a JSONL con un script: la mitad de tokens de salida que Haiku.
