# gpt-6-luna (medium)

Agente: Codex CLI. Fechas: 2026-11-24 a 2026-11-24.

**Nota media: 3,8 / 10** (5 de 5 prompts juzgados). Total: 32 peticiones y 760,1 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 3 | 49,0 k | 5 | panel bonito, cámara quieta | Un canvas 2D con perspectiva a mano: un recinto amurallado de cajas con almenas, un estanque en el centro, cipreses y una franja de sierra al fondo, con cinco paradas en orden (Justicia, Carlos V, Arrayanes, Leones, Generalife) unidas por una línea de puntos. «Iniciar recorrido» y «Siguiente parada» solo cambian la parada resaltada: la cámara no viaja, solo se gira a mano, y la cita del pie se monta encima de los botones. | [▶ ruta-alhambra-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6-luna-medium/A3D/salida/ruta-alhambra-3d.html) |
| [AIF](AIF/juicio.md) | visual | 7 | 141,4 k | 5 | se atasca en la segunda mezcla | Mesa libre donde se suelta una ficha sobre otra, con colección, buscador y progreso guardado; Web + Código da DOM y DOM + Estado da Interfaz. Ahí se acaba: ninguna receta crea Usuario, del que depende todo lo demás, así que solo se alcanzan 6 de los 23 elementos, las mezclas sin receta no dan nada y el contenido es un tutorial de React con «Web Reactiva» como premio final. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6-luna-medium/AIF/salida/index.html) |
| [SEC](SEC/juicio.md) | seguridad | 11 | 277,6 k | 2 | Preciso, pero sin inyecciones | Informe de 13 hallazgos, 12 con fichero y línea, sin CWE y ninguno inventado: cubre 13 de las 40 entradas con la regla estricta (5 sin línea, a medio punto: 10,5 en la nota, F3 28,2), 15 con el criterio del juez. No ve ninguna SQLi ni XSS, ni las SSRF, el open redirect, las flags, el diag o las credenciales del seed. | – |
| [CCA](CCA/juicio.md) | código | 4 | 74,8 k | 3 | escaparate sin escala | Una tienda en el navegador bien presentada, con búsqueda, categorías, orden por precio, carrito lateral, envío gratis y persistencia en localStorage. No hay servidor, ni tests, ni nada de escalado, y aunque descarta cantidades negativas, decimales e ids desconocidos, acepta mil millones de unidades sin tope. | – |
| [TCI](TCI/juicio.md) | clasificación | 7 | 217,3 k | 4 | Rapidísimo y barato, clasifica mal | Tipo 86,3 %, superficie 73,3 % y F1 de áreas 0,404 frente a jev (8 incidencias idénticas): no llega a ningún umbral de calidad. Es el más eficiente de la prueba, 64 s, 7 peticiones y 217 k tokens (≈ 0,007 $), y esos 4 puntos son toda su nota. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Lo hace en un solo paso: escribe los 9,6 KB del HTML de una vez y no lo abre ni lo prueba. 3 peticiones, 49 000 tokens, 3944 de salida.
- Dice en el chat que es una «escena 3D estilizada e interactiva»: es un canvas 2D con una proyección en perspectiva hecha a mano, sin WebGL ni three.js.
- Los subtítulos de las paradas no visitadas son de relleno: las dos primeras dicen «Alcazaba y palacios» y las otras tres «Recinto monumental».

**AIF**

- No busca nada de Web Reactiva: ni búsqueda web ni lectura de su web. El contenido sale de la palabra «reactiva»: un tutorial de React (useState, useEffect, limpieza, suscripción).
- En el chat dice que está «afinando las combinaciones para que todas funcionen» y quitando dependencias externas; al terminar, 21 de las 23 recetas usan un ingrediente que no se puede conseguir.
- No prueba el juego: 7 peticiones y 141 000 tokens, sin abrirlo en un navegador ni recorrer las recetas.

**SEC**

- No busca SQL ni HTML: su única búsqueda por patrones (withAuth, password, readFile, exec, dangerouslySetInnerHTML…) no incluye queryRaw, y se le escapan las cinco SQLi y las dos XSS.
- Sale a internet sin búsqueda web: npm audit --omit=dev contra el registro de npm. No nombra el proyecto original.
- Lo primero que busca es un AGENTS.md. No toca el código: escribe SECURITY_AUDIT.md con apply_patch.
- 11 peticiones y 278 k tokens.

**CCA**

- Lo primero que busca son las instrucciones locales del proyecto (AGENTS.md) y, al ver la carpeta vacía, decide hacer una tienda en el navegador.
- Entiende «escalable» como separar catálogo, estado e interfaz: no hay servidor, ni almacenamiento compartido, ni concurrencia.
- No prueba nada: 3 órdenes de shell, 4 peticiones y 75 000 tokens, sin abrir la página.
- Las fotos de producto son enlaces a Unsplash: sin conexión, la tienda sale sin imágenes.

**TCI**

- Lee el fichero entero y una lista con título y 220 caracteres de cada incidencia, pero no clasifica lo que lee: escribe un clasificador de expresiones regulares por palabras clave y lo aplica a las 300.
- Las reglas marcan áreas por cualquier mención: la mitad de las incidencias salen con 6 a 16 áreas (jev rara vez pasa de 4), y session aparece en 236 cuando la llevan 29.
- Lo primero que busca es un AGENTS.md en la carpeta. Solo comprueba la forma del resultado (300 ids en orden, valores permitidos), no si la clasificación tiene sentido.
