# ollama/deepseek-v4.1-flash

Agente: OpenCode. Fechas: 2026-11-19 a 2026-11-19.

**Nota media: 7,2 / 10** (4 de 4 prompts juzgados). Total: 94 peticiones y 6050,4 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio |
|---|---|---:|---:|---:|---|---|
| [A3D](A3D/juicio.md) | visual | 33 | 2231,2 k | 6 | la mejor maqueta, el tour falla | La vista general es la mejor de todo el benchmark: colina de la Sabika amurallada, Alcazaba con torres, Palacio de Carlos V con su patio circular, Generalife con la acequia, casas alrededor y Sierra Nevada. Pero al iniciar el recorrido la cámara se mete dentro de la muralla y a los 35 s sigue en la primera de solo 5 paradas. |
| [AIF](AIF/juicio.md) | visual | 32 | 2646,1 k | 9 | Infinite Craft de verdad | La mecánica más fiel a Infinite Craft de todo el benchmark: lienzo libre donde se suelta una pieza sobre otra, almacén con buscador y una misión (descubrir el Atlas Malandriner). 78 elementos y 90 recetas sacados de webreactiva.com, todos alcanzables, con pistas, sonido y guardado. Pero no es infinito: fuera de las 90 recetas, las mezclas no dan nada. |
| [CCA](CCA/juicio.md) | código | 26 | 1143,5 k | 6 | bonito, escala el código, no el sistema | Una tienda completa y muy cuidada (catálogo, búsqueda, carrito, cupones, envío, IVA, checkout) con un motor de precios por reglas, dinero en céntimos, almacenamiento intercambiable y 23 tests. Pero el carrito vive en localStorage y el servidor solo sirve estáticos: «escalable» lo resuelve como código fácil de ampliar, sin nada que aguante muchos usuarios. |
| [PTS](PTS/juicio.md) | texto | 3 | 29,6 k | 8 | bueno, pero se desvía | 1426 palabras con buenos argumentos (habituación, fatiga de alarmas, «500 tests con 30 en rojo son 470 con un 100 % de desconfianza», el test que se vuelve «guardián del error») y un ejemplo de skip en pytest. Pero trata sobre todo de tests que fallan siempre o se ignoran, no de los que fallan «a veces», y tiene más slop de formato: 20 negritas, listas con etiqueta y «Conclusión». |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché).

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

**CCA**

- Se inventó una tienda entera, «Nébula Store», con 11 productos, valoraciones y emojis, cuando el prompt solo pedía un carrito.
- 26 peticiones y 1,14 millones de tokens.
- El único CCA con interfaz: los demás entregaron librerías o API.
- Listó la carpeta de sus propias pruebas anteriores (A3D, MWP) buscando contexto; no tocó las de otros modelos. Corrió antes del encierro.

**PTS**

- El más largo de todos (1426 palabras) y el que más se aleja del tema pedido: los tests intermitentes ocupan una sección de nueve.
- Usa variante americana en un texto por lo demás neutro: «costo», «monitoreo», «la falla».
- 3 peticiones y 2,9 k tokens de salida.
