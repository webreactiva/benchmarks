# ollama/deepseek-v4.1-flash

Agente: OpenCode. Fechas: 2026-11-19 a 2026-11-24.

**Nota media: 7,4 / 10** (5 de 5 prompts juzgados). Total: 136 peticiones y 9983,0 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 33 | 2231,2 k | 6 | la mejor maqueta, el tour falla | La vista general es la mejor de todo el benchmark: colina de la Sabika amurallada, Alcazaba con torres, Palacio de Carlos V con su patio circular, Generalife con la acequia, casas alrededor y Sierra Nevada. Pero al iniciar el recorrido la cámara se mete dentro de la muralla y a los 35 s sigue en la primera de solo 5 paradas. | [▶ alhambra-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_deepseek-v4.1-flash/A3D/salida/alhambra-3d.html) |
| [AIF](AIF/juicio.md) | visual | 32 | 2646,1 k | 9 | Infinite Craft de verdad | La mecánica más fiel a Infinite Craft de todo el benchmark: lienzo libre donde se suelta una pieza sobre otra, almacén con buscador y una misión (descubrir el Atlas Malandriner). 78 elementos y 90 recetas sacados de webreactiva.com, todos alcanzables, con pistas, sonido y guardado. Pero no es infinito: fuera de las 90 recetas, las mezclas no dan nada. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_deepseek-v4.1-flash/AIF/salida/index.html) |
| [SEC](SEC/juicio.md) | seguridad | 30 | 3103,0 k | 7 | Ve mucho, con rangos anchos | Informe de 38 hallazgos, todos con CWE, en el que el juez reconoce 34 de las 40 entradas y solo dos no se sostienen, pero la nota cuenta 22,5 (F3 56,6): ocho de sus rangos pasan de 20 líneas y diez entradas valen medio acierto, como si no diera línea. Se le escapan el oráculo de padding, la fuga de la URL interna del asistente, el logout, el token de soporte en claro y en la respuesta, y la página de noticias. | – |
| [CCA](CCA/juicio.md) | código | 26 | 1143,5 k | 6 | bonito, escala el código, no el sistema | Una tienda completa y muy cuidada (catálogo, búsqueda, carrito, cupones, envío, IVA, checkout) con un motor de precios por reglas, dinero en céntimos, almacenamiento intercambiable y 23 tests. Pero el carrito vive en localStorage y el servidor solo sirve estáticos: «escalable» lo resuelve como código fácil de ampliar, sin nada que aguante muchos usuarios. | – |
| [TCI](TCI/juicio.md) | clasificación | 15 | 859,2 k | 9 | Casi igual, por un céntimo | Tipo 96,0 %, superficie 87,3 % y F1 de áreas 0,667 frente a jev (70 idénticas). Le costó 87 s, 15 peticiones y 0,86 M tokens (≈ 0,01 $ al precio de OpenRouter). | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- 33 peticiones y 2,2 millones de tokens (2,07 M de caché): el mayor gasto de todo el benchmark en un solo prompt.
- Se escribió su propio cliente de Chrome DevTools Protocol por WebSocket para hacer capturas, y las analizó leyendo píxeles con PIL en Python; luego hizo 12 ediciones sobre el HTML.
- Dejó ficheros fuera de su carpeta (/tmp/alhambra.png, /tmp/cdp-test.js…).
- En el chat dice que la ruta tiene «paradas seleccionables» y «control de velocidad», y es cierto: lo que no dice es que el tour arranca dentro de una pared.

**AIF**

- Repetición sin tope de salida (la primera, cortada a 32 000 tokens, está en _descartados). Esta vez su respuesta más larga fue de 27 180 tokens: no necesitaba más, la otra vez lo planteó de otra forma.
- Leyó webreactiva.com y /now para el contenido.
- 32 peticiones y 2,6 millones de tokens.
- Ya encerrado, buscó Chrome y Playwright para probarlo; no encontró nada fuera de su carpeta que no fuera del sistema.

**SEC**

- Dice que el proyecto es «un entorno de laboratorio/CTF» por las flags QKB{…}; no nombra el proyecto original.
- No sale a internet: 43 comandos de shell locales (cat, grep, sed, find y cuatro scripts de Python), sin curl, git ni npm audit; los curl solo aparecen en las PoC. Los CVE de Next y React los cita de memoria (el de React lo sugiere la variable FLAG_CVE_2025_55182 de .env.local).
- Saca con un script de Python las 35 flags de prisma/seed.ts y las publica en flags_encontrados.csv; con otro reproduce el generador de tarjetas regalo y da el código de la tarjeta sembrada de 500 USD.
- Deja cuatro ficheros (SECURITY_AUDIT.md, hallazgos.json, flags_encontrados.csv, README_AUDITORIA.md), juzgados como un solo informe; los dos edit corrigen el recuento de su propio informe (37 → 38).
- Da CWE en los 38 hallazgos y línea en 37, pero ocho ubicaciones son rangos de más de 20 líneas (18-52, 81-102, 102-141, 52-92, 8-60, 7-55, 120-142, 60-90): las diez entradas que cubren valen medio acierto.
- Sin subagentes, errores ni compactaciones; termina en 5 min 33 s. No toca el código del proyecto.

**CCA**

- Se inventó una tienda entera, «Nébula Store», con 11 productos, valoraciones y emojis, cuando el prompt solo pedía un carrito.
- 26 peticiones y 1,14 millones de tokens.
- El único CCA con interfaz: los demás entregaron librerías o API.
- Listó la carpeta de sus propias pruebas anteriores (A3D, MWP) buscando contexto; no tocó las de otros modelos. Corrió antes del encierro.

**TCI**

- Guarda el resultado como classificacion.jsonl (con una s de más); el corrector lo encuentra igual.
- Es el único que iguala la nota de Haiku 5.5, y por menos dinero.
