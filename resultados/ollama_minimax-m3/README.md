# ollama/minimax-m3

Agente: OpenCode. Fechas: 2026-11-19 a 2026-11-24.

**Nota media: 7,0 / 10** (5 de 5 prompts juzgados). Total: 366 peticiones y 39202,5 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 80 | 11368,3 k | 4 | lo más ambicioso, no se recorre | El A3D con más cosas: 15 paradas con textos ricos y consejos de visita, 4 vistas, deslizador de hora del día, narración por voz, minimapa y arcos de herradura generados por código. Pero el recorrido apenas avanza, saltar a una parada no mueve la cámara (se queda en la plaza de entrada) y el minimapa tapa las paradas 11 a 15 de la lista. | [▶ alhambra-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_minimax-m3/A3D/salida/alhambra-3d.html) |
| [AIF](AIF/juicio.md) | visual | 76 | 11453,8 k | 9 | el mejor AIF, con mucho | 399 elementos y 1780 recetas sacados de webreactiva.com de verdad (glosario, cursos, skills, comunidad Malandriner), un generador para las mezclas sin receta, 7 legendarios, pistas, bitácora, compartir por URL, y el logo, los colores y la tipografía de la marca. Funciona sin conexión. Le falta el lienzo libre de Infinite Craft: combina en dos calderos. | [▶ alquimia-reactiva.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_minimax-m3/AIF/salida/alquimia-reactiva.html) |
| [SEC](SEC/juicio.md) | seguridad | 30 | 1694,4 k | 6 | Amplio, flojo en líneas | Informe de 46 hallazgos (en Markdown y en JSON) en el que el juez reconoce 31 de las 40 entradas, pero con la regla estricta se queda en 21 aciertos (18 con línea y 6 a medio punto) y F3 51,3: lo de severidad media va sin línea y cuatro aciertos citan líneas fuera de la ventana o otro fichero. Se le escapan el oráculo de padding, la API de flags, el XSS de reseñas, el open redirect, el logout, el token de soporte en claro, la fuga de la respuesta del asistente y la página de noticias. | – |
| [CCA](CCA/juicio.md) | código | 155 | 12922,7 k | 10 | escala de verdad, con Redis | Monorepo TypeScript con dominio hexagonal, API Fastify sin estado, Redis con scripts Lua (CAS por versión, reserva de stock, idempotencia), outbox, métricas, SSE y una tienda React. Compila, pasa 69 tests y, con dos instancias sobre el mismo Redis, 40 altas a la vez no pierden ni un dato. Lo único discutible: bajo mucha contención devuelve 409 en vez de reintentar más. | – |
| [TCI](TCI/juicio.md) | clasificación | 25 | 1763,3 k | 6 | Bien, con script propio | Tipo 96,3 %, superficie 86,3 % y F1 de áreas 0,617 frente a jev (54 idénticas). Le costó 414 s, 25 peticiones y 1,76 M tokens (≈ 0,169 $ al precio de OpenRouter). | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

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

**SEC**

- Dice que las cadenas QKB{…} son «flags de un ejercicio de captura de banderas (CTF)» y copia en el informe la de .env.local y el código del system prompt del asistente; no nombra el proyecto original.
- Sale a internet dos veces: ejecuta npm audit --json, que consulta el registro de npm (WebFetch y WebSearch estaban denegados). De ahí salen los 33 avisos, los GHSA y la versión next@15.5.29 de QB-013. Guarda esa salida en /tmp/opencode/audit.json, fuera de la carpeta de trabajo.
- Deja dos ficheros con los mismos 46 hallazgos (SECURITY_AUDIT.md y security-findings.json); se juzgan como un solo informe. El JSON añade líneas que el Markdown no da, pero las de la SSRF de soporte (42, 45, 48) apuntan al catch final y no a la fetch.
- El primer borrador salió con caracteres chinos mezclados en el texto («的实施», «的其他»); los localiza con grep y node y los corrige con cinco edits, pero quedan palabras pegadas o en otro idioma («una.backdoor», «simpleZoop», «puedeidir», «La fonction», «unaofuscación»).
- Anuncia «a verification script» que no llega a crear y el último mensaje sale vacío: termina en 8 min 16 s sin resumen en el chat, sin errores ni compactaciones.
- Da CWE en los 46 hallazgos, pero solo 20 dan fichero y línea (43 %): los 18 de severidad media y baja van sin línea.
- No toca el código: solo crea sus dos ficheros de informe (36 comandos de shell, 2 write y 5 edit).

**CCA**

- 155 peticiones y 12,9 millones de tokens: el mayor gasto de todo el benchmark en una sola prueba.
- En la primera tirada preguntó qué stack usar; en esta, con la regla «Decide tú.» ya puesta, no preguntó: decidió solo y eligió lo mismo que recomendaba entonces (Node + TypeScript + Fastify + Redis).
- Encontró el redis-server del sistema dentro del encierro y lo usó para sus tests de integración y un smoke test de punta a punta.
- Dejó 210 MB de node_modules y las carpetas dist en la entrega.

**TCI**

- Escribe un classify.py y clasifica con él (lo deja en salida/).
