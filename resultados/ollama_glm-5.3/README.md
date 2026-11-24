# ollama/glm-5.3

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-24.

**Nota media: 7,6 / 10** (5 de 5 prompts juzgados). Total: 126 peticiones y 10759,7 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 21 | 3065,1 k | 8 | bonita, con tropiezos | Maqueta con three.js y nueve paradas, de la Puerta de la Justicia al Generalife, con ruta guiada que vuela de una a otra, itinerario clicable y vista aérea en la que se reconoce el recinto: Carlos V circular, la fuente de los Leones, el Patio de la Acequia. Pero en Arrayanes la cámara queda contra un muro, en Leones un marcador tapa media vista y sitúa a Washington Irving hospedado en la Plaza de los Aljibes. | [▶ alhambra-ruta-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_glm-5.3/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 29 | 2753,7 k | 10 | infinito y de la casa | Tablero libre donde se suelta una ficha sobre otra, 187 elementos y 192 recetas todos alcanzables desde Humano, Café, Prompt y Terminal, y un generador para las mezclas sin receta que cuenta los inventos aparte. El contenido sale de la portada de webreactiva.com (Programa con IA, Fichómetro, Atlas Malandriner, En Pantuflas, «sin alucinar»), con pistas, retos, buscador y guardado. | [▶ alquimia-reactiva.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_glm-5.3/AIF/salida/alquimia-reactiva.html) |
| [CCA](CCA/juicio.md) | código | 31 | 1975,7 k | 8 | limpio, una sola instancia | API Express en TypeScript con capas y puertos, SQLite nativo de Node, dinero en céntimos, precio siempre del catálogo, descuentos, envío, IVA, checkout con stock, validación estricta y una interfaz web; compila, pasa 19 tests y 50 altas a la vez en una instancia no pierden nada. Pero no tiene control de versión: con dos instancias sobre el mismo SQLite seis de cincuenta altas acaban en error 500. | – |
| [SEC](SEC/juicio.md) | seguridad | 32 | 1662,7 k | 6 | Amplio, localiza con rangos anchos | Informe de 37 hallazgos (en Markdown y en JSON) en el que el juez reconoce 32 de las 40 entradas y solo uno no se sostiene, pero con la regla estricta se queda en 21,5 aciertos (16 con línea y 11 a medio punto) y F3 54,4: tres aciertos no dan línea y ocho caen en rangos de más de 20 líneas. Se le escapan el oráculo de padding, los dos XSS de reseñas y el open redirect, el IDOR de wishlists, el token de soporte en claro, la fuga de la URL del asistente, el logout y la página de noticias. | – |
| [TCI](TCI/juicio.md) | clasificación | 13 | 1302,5 k | 6 | Bien, lento y más caro | Tipo 97,3 %, superficie 88,7 % y F1 de áreas 0,608 frente a jev (71 idénticas). Le costó 409 s, 13 peticiones y 1,3 M tokens (≈ 0,223 $ al precio de OpenRouter). | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Lo reescribió entero tras revisar la geometría y lo probó en Chrome con Playwright: capturas del tour y análisis de los píxeles para comprobar que el cielo y la piedra se veían.
- Buscó navegadores también en /root/.cache/ms-playwright (vacío dentro del encierro).
- 21 peticiones y 3,1 millones de tokens (2,9 de caché).

**AIF**

- Las dos búsquedas web fallaron (una cancelada por el permiso y otra sin resultado); leyó la portada de webreactiva.com con webfetch.
- Lo probó a fondo en Chrome con Playwright: arrastrar, combinar, borrar, duplicar, y validó con un BFS que todo era alcanzable.
- 29 peticiones y 2,8 millones de tokens (2,5 de caché).

**CCA**

- Preguntó con la herramienta de preguntas qué stack usar; el lanzador la cerró y siguió con su opción recomendada (Node/Express + TypeScript).
- Lo probó de punta a punta con curl contra el servidor, incluido que el stock persiste entre reinicios.
- Entrega dist/ y data/cart.db junto al código.
- 31 peticiones y 2 millones de tokens (1,8 de caché).

**SEC**

- Dice que es «un entorno de evaluación de seguridad tipo CTF» por flag.txt y las flags QKB{…}; no nombra el proyecto original.
- No sale a internet: 57 lecturas y 20 comandos de shell locales (find, cat, sed, grep y dos node -e para validar su propio JSON). Los CVE de Next los cita de memoria y describe mal CVE-2025-55182 como envenenamiento de caché, deducido del nombre de una variable de .env.local; los curl solo aparecen en las PoC.
- Deja dos ficheros con los mismos 37 hallazgos (AUDITORIA-SEGURIDAD.md y hallazgos.json); se juzgan como un solo informe. Corrige con dos edits los totales por severidad, que había escrito mal (38 en vez de 37). El resumen anuncia «4 vectores de XSS» y solo describe dos.
- Termina en 3 min 29 s sin errores, cortes ni compactaciones.
- Da CWE en los 37 hallazgos, pero cinco no dan línea y ocho aciertos caen en rangos de más de 20 líneas (51-91, 110-141, 81-102, 17-49, 8-64, 64-85, 37-133), que se quedan en medio punto.
- No toca el código: solo crea sus dos ficheros de informe.
