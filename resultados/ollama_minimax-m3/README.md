# ollama/minimax-m3

Agente: OpenCode. Fechas: 2026-11-19 a 2026-11-20.

**Nota media: 7,8 / 10** (4 de 4 prompts juzgados). Total: 317 peticiones y 35848,7 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio |
|---|---|---:|---:|---:|---|---|
| [A3D](A3D/juicio.md) | visual | 80 | 11368,3 k | 4 | lo más ambicioso, no se recorre | El A3D con más cosas: 15 paradas con textos ricos y consejos de visita, 4 vistas, deslizador de hora del día, narración por voz, minimapa y arcos de herradura generados por código. Pero el recorrido apenas avanza, saltar a una parada no mueve la cámara (se queda en la plaza de entrada) y el minimapa tapa las paradas 11 a 15 de la lista. |
| [AIF](AIF/juicio.md) | visual | 76 | 11453,8 k | 9 | el mejor AIF, con mucho | 399 elementos y 1780 recetas sacados de webreactiva.com de verdad (glosario, cursos, skills, comunidad Malandriner), un generador para las mezclas sin receta, 7 legendarios, pistas, bitácora, compartir por URL, y el logo, los colores y la tipografía de la marca. Funciona sin conexión. Le falta el lienzo libre de Infinite Craft: combina en dos calderos. |
| [CCA](CCA/juicio.md) | código | 155 | 12922,7 k | 10 | escala de verdad, con Redis | Monorepo TypeScript con dominio hexagonal, API Fastify sin estado, Redis con scripts Lua (CAS por versión, reserva de stock, idempotencia), outbox, métricas, SSE y una tienda React. Compila, pasa 69 tests y, con dos instancias sobre el mismo Redis, 40 altas a la vez no pierden ni un dato. Lo único discutible: bajo mucha contención devuelve 409 en vez de reintentar más. |
| [PTS](PTS/juicio.md) | texto | 6 | 103,9 k | 8 | un ensayo, no un post | 2800 palabras con lo que no tiene ningún otro: la cuenta de por qué la suite casi nunca sale verde (0,95^1000), tablas de coste, código TypeScript con el antes y el después, niveles de suite y caducidad de la cuarentena. Pero es tres veces más largo que un post, tiene errores dentro de sus propios ejemplos y 43 negritas, 8 rayas y emojis. |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché).

## Rarezas

**A3D**

- 80 peticiones y 11,4 millones de tokens: cinco veces el siguiente gasto más alto de todo el benchmark.
- Escribió el HTML por partes en /tmp/opencode (cabecera, núcleo, ruta, escena) y luego las juntó.
- Buscó en su propio texto restos en inglés y chino («Muslims», «Islamic», «传入») para limpiarlos.
- Usó el Playwright instalado en el sistema y lanzó rayos contra la geometría para asegurar que la ruta no atraviesa muros. Dice que todo funciona; la cámara no se mueve.
- Error histórico en una ficha: los leones originales volvieron a la fuente en 2012, no están en el museo.

**AIF**

- 76 peticiones y 11,5 millones de tokens, como en su A3D: los dos HTML grandes de MiniMax gastan diez veces lo que el resto.
- Lanzó un subagente para catalogar la web: leyó sitemap, llms.txt, openapi.json, la API de búsqueda y el bundle de skills, unos 1900 nombres.
- Descargó el CSS de la web para sacar los colores y embebió la tipografía Sculpin y el logo en base64.
- Hizo ls / y find / buscando «reactiv»; ya corría dentro del encierro y no encontró nada.
- Verificó con un script que los 399 elementos son alcanzables y lo probó en Chromium de 360 a 1440 px.

**CCA**

- 155 peticiones y 12,9 millones de tokens: el mayor gasto de todo el benchmark en una sola prueba.
- En la primera tirada preguntó qué stack usar; en esta, con la regla «Decide tú.» ya puesta, no preguntó: decidió solo y eligió lo mismo que recomendaba entonces (Node + TypeScript + Fastify + Redis).
- Encontró el redis-server del sistema dentro del encierro y lo usó para sus tests de integración y un smoke test de punta a punta.
- Dejó 210 MB de node_modules y las carpetas dist en la entrega.

**PTS**

- Volvió a buscar en su texto palabras en inglés («the», «would», «phenomenon», «shapedando») para limpiarlas, como en A3D.
- Añadió frontmatter YAML de blog (title, date, tags, excerpt) sin que nadie se lo pidiera.
- El primer ejemplo de «test que depende del reloj real» es justo el arreglo: usa clock.setSystemTime.
- Define «flake rate» como ejecuciones en rojo entre ejecuciones totales, que es la tasa de fallo, no la de intermitencia.
- 6 peticiones y 11 k tokens de salida.
