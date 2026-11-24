# ollama/glm-5.3-flash

Agente: OpenCode. Fechas: 2026-11-19 a 2026-11-24.

**Nota media: 6,6 / 10** (5 de 5 prompts juzgados). Total: 99 peticiones y 5776,0 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 29 | 1822,9 k | 6 | se recorre y se reconoce | Ruta guiada a pie de calle que arranca sola y avanza por 8 puntos (Justicia, Vino, Alcazaba, Carlos V, Leones, Arrayanes y Comares, Generalife) más un modo libre con una de las mejores maquetas del benchmark: la Torre de Comares, Carlos V con su patio circular, el anillo de columnas de los Leones, la Alcazaba almenada y el Darro. Pero empieza dentro de un muro y en el recorrido la cámara roza las paredes. | [▶ alhambra-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_glm-5.3-flash/A3D/salida/alhambra-3d.html) |
| [AIF](AIF/juicio.md) | visual | 4 | 250,7 k | 8 | buen juego, Web Reactiva inventado | Mecánica muy fiel a Infinite Craft (mesa infinita con zoom, soltar una ficha sobre otra, panel de descubrimientos con buscador, sonidos), 145 recetas todas alcanzables y un generador de «invenciones raras» para las mezclas sin receta. Pero el contenido de Web Reactiva es inventado: «Nacho Ojea», «Trece Tigres», «La Red», ZX Spectrum y GeoCities; parte de Internet, Radio, Cine y Juego. | [▶ web-reactiva-craft.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/ollama_glm-5.3-flash/AIF/salida/web-reactiva-craft.html) |
| [SEC](SEC/juicio.md) | seguridad | 18 | 1158,0 k | 5 | Ve casi todo, localiza a medias | Informe de 39 hallazgos en el que el juez reconoce 35 de las 40 entradas y solo uno no se sostiene, pero con la regla estricta se queda en 22 aciertos (15 con línea y 14 a medio punto) y F3 55,7: seis aciertos no dan línea y ocho citan rangos de más de 20 líneas, que valen como sin línea. Se le escapan el oráculo de padding, la fuga de la URL interna del asistente, la inyección por salida de herramientas, el token de soporte en claro y la página de noticias. | – |
| [CCA](CCA/juicio.md) | código | 33 | 1083,0 k | 8 | bien diseñado, Redis roto | Python con capas (dominio, aplicación, infraestructura, API HTTP), Decimal para el dinero, precios del catálogo, bloqueo por carrito en memoria, límites y 24 tests en verde. Pero el adaptador de Redis, que es lo que lo haría escalar, captura self._client.WatchError, que no existe: un conflicto de concurrencia o cualquier error de negocio acaba en AttributeError. | – |
| [TCI](TCI/juicio.md) | clasificación | 15 | 1461,5 k | 6 | Bien, pero lento | Tipo 96,3 %, superficie 87,7 % y F1 de áreas 0,608 frente a jev (63 idénticas). Le costó 348 s, 15 peticiones y 1,46 M tokens (≈ 0,072 $ al precio de OpenRouter). | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Tercera tirada de GLM en este prompt: la primera se cortó en el tope de 32 000 tokens y la segunda compactaba sin parar por nuestra configuración (las dos en _descartados). Esta, limpia: 0 compactaciones, 1 mensaje.
- Es un HTML distinto al de la tirada anterior (aquella era más pequeña, con 8 paradas y botones anterior/siguiente): la misma petición da obras distintas.
- Lo comprobó en Chrome headless capturando 9 tramos del recorrido.
- 29 peticiones y 1,8 millones de tokens.

**AIF**

- Tercera tirada de GLM en AIF (las dos anteriores, cortada a 32 000 tokens y con compactación constante, en _descartados). Esta: 4 peticiones, 1 write de 48 k tokens, 0 compactaciones.
- No consultó la web y se inventó un Web Reactiva de radio y frikismo, con presentadores que no existen («Nacho Ojea»).
- La bienvenida se abre al cargar y bloquea la mesa hasta pulsar «¡A construir!»; en un navegador sin GPU el fondo desenfocado no se pinta y parece que el juego no responde.

**SEC**

- Dice que es «una app tipo CTF» con vulnerabilidades plantadas por las flags QKB{…}; no nombra el proyecto original.
- No sale a internet: solo usa read, glob, grep y tres comandos de shell locales (grep en package-lock, cat de .dockerignore, un script de Python sobre package-lock). El CVE de Next lo cita de memoria; los curl solo aparecen en las PoC del informe.
- Lee 101 ficheros uno a uno sin subagentes y termina en 2 min 17 s, sin errores ni compactaciones.
- Da CWE en los 20 hallazgos críticos y altos y en ninguno de los medios y bajos; seis aciertos sin línea y ocho con rangos de más de 20 líneas (19-67, 51-101, 45-67, 8-75, 103-134, 35-218) se quedan en medio punto.
- No toca el código: solo crea informe-auditoria-seguridad-quokka-bazaar.md.

**CCA**

- 33 peticiones y 1,08 millones de tokens. Fue y vino con los tests varias veces hasta ponerlos en verde, y arrancó el servidor y lo probó con curl.
- Dejó __pycache__ y .pytest_cache en la carpeta de entrega.
- Los tests del adaptador de Redis no existen: la pieza rota es justo la que no probó.
- Añadir un producto que ya está en el carrito no suma: da DuplicateProductError y pide usar PATCH.
