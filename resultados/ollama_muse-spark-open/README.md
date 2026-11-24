# ollama/muse-spark-open

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 6,2 / 10** (5 de 5 prompts juzgados). Total: 139 peticiones y 9438,9 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 5 | 88,0 k | 7 | bonita por fuera, cámara perdida | Interfaz muy cuidada (Cinzel, fichas con datos, progreso, minimapa, leyenda, día y noche) y 7 paradas con textos correctos, y el recorrido automático avanza. Pero la escena está tan a escala que la cámara va siempre pegada a los volúmenes, hasta en «vista aérea», y al saltar de parada con «Siguiente» la consola se llena de errores (unos 150, uno por fotograma). | [▶ alhambra-ruta-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_muse-spark-open/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 9 | 391,6 k | 8 | muy de la casa, rama de IA bloqueada | Contenido sacado de cuatro páginas de webreactiva.com con mucho humor de la casa («Combustible oficial del developer. 100 % malandriner», «Dirigible (400 € en tokens)»), mesa libre donde se combina soltando una ficha sobre otra, filtros, pistas y recetas secretas. Pero una receta posterior (IA + Código = Python) pisa a la que anuncia como clave (Código + IA = Prompt): sin Prompt no se puede llegar a agentes, skills, MCP, Claude Code ni SDD. Solo 68 de 102 alcanzables, y el botón «Combinar» no registra nada. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_muse-spark-open/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 24 | 603,7 k | 9 | bien pensado, sin Redis | Python sin dependencias: agregado de carrito con límites, motor de precios con reglas (por volumen, categoría, cupón), IVA y envío, reserva de stock, bus de eventos, servicio sin estado con versión optimista y reintentos, almacenamiento en memoria, en fichero o repartido en shards, y una API REST. Pasa 12 tests y 50 hilos no pierden nada. Pero Redis o DynamoDB son solo un contrato. | – |
| [SEC](SEC/juicio.md) | seguridad | 26 | 1518,6 k | 2 | Ve bastante, localiza mal | Informe de 26 hallazgos repartido en cuatro ficheros, en el que el juez reconoce 32 de las 40 entradas con solo dos que no se sostienen, pero con la regla estricta se queda en 15 aciertos (F3 38,5): la mitad de lo que ve lo sitúa fuera de la ventana, en otro fichero o junto a otro fallo. Se le escapan el alta como ADMIN, el open redirect, la enumeración del login, el logout, el token de soporte en claro y en la respuesta, la fuga del asistente y la página de noticias, y dedica una sección y un fichero a inventariar flags. | – |
| [TCI](TCI/juicio.md) | clasificación | 75 | 6837,0 k | 5 | Bien, el más caro | Tipo 96,0 %, superficie 85,0 % y F1 de áreas 0,627 frente a jev (73 idénticas). Le costó 237 s, 75 peticiones y 6,84 M tokens (≈ 1,937 $ al precio de OpenRouter). | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- 5 peticiones: lo escribió de una vez, sin probarlo.
- Promete «124 columnas + 12 leones» modelados; desde la cámara no se ven.

**AIF**

- Presume en la respuesta y en el propio juego de «Prompt = Código + IA» como receta secreta, y es justo la que no funciona.
- Dejó un parche que «arregla» recetas rotas cambiándolas por humo en vez de corregirlas.
- 9 peticiones y 4 lecturas de la web.

**CCA**

- Ofrece dos API: una con la librería estándar y otra con FastAPI.
- 24 peticiones y 604 k tokens.
- Dejó __pycache__ en la entrega.

**SEC**

- Llama a las QKB{…} «flags CTF internas» y «canarios de explotación»; no nombra el proyecto original.
- Hace inventario de flags: una sección entera del informe («Inventario de Flags Recuperadas», doce con su origen) y un fichero aparte, INVENTARIO_FLAGS.txt, con las 35 flags de prisma/seed.ts sacadas con grep; el resumen ejecutivo repite nueve en claro. Usa además una pista del seed (flagHints, línea 500) para describir el secuestro del directo.
- PRUEBAS_POC.sh no ejecuta nada contra la app: lo escribe y le da permisos con chmod +x, pero nunca lo lanza (no hay servidor). Si se ejecutara, haría cat de flag.txt y los otros ficheros con secretos y lanzaría curl contra localhost:3000 (flags, login de bob, logs del SIEM, MCP, export y SQLi).
- No sale a internet: 85 lecturas, 6 globs y 6 comandos de shell locales (grep de QKB{, cat, base64 -d, ls y un git log que falla porque no hay repositorio). Los curl solo aparecen en las PoC, que el informe declara «validados sintácticamente».
- Deja cuatro ficheros juzgados como un solo informe; el resumen ejecutivo y el inventario no añaden hallazgos. El resumen anuncia 24 hallazgos (6/8/6/4) que no cuadran con las secciones, y el informe remite a un anexo hallazgos_secretos.json que no existe.
- No lee signup, LoginForm, AnalyticsClient, ProductDetailClient, logout ni la página de noticias: de ahí que falten el alta como ADMIN, el open redirect, el logout y las noticias, y que los dos XSS solo los vea desde la API.
- Da CWE en 16 de 26 hallazgos (62 %) y línea en 23 (88 %). Termina en 3 min 46 s, 26 peticiones, sin errores, cortes ni compactaciones. No toca el código: solo crea sus cuatro ficheros.

**TCI**

- Reparte el trabajo entre 3 subagentes, que gastan 1,8 M de los 6,8 M tokens y 38 de las 75 peticiones.
