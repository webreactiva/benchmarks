# gpt-6.2-sol (medium)

Agente: Codex CLI. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 7,7 / 10** (3 de 5 prompts juzgados). Total: 86 peticiones y 4361,3 k tokens.

Pendientes: SEC, TCI.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 32 | 1688,3 k | 10 | maqueta clara y se recorre | Una maqueta 3D en low-poly con las torres de la Alcazaba, el patio circular de Carlos V y la acequia del Generalife, y una ruta de cinco paradas en orden de visita que la cámara recorre con «Siguiente». La vista no se tapa, las etiquetas se leen y los textos son correctos; el botón «Iniciar ruta» solo encuadra la primera parada. | [▶ alhambra.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-sol-medium/A3D/salida/alhambra.html) |
| [AIF](AIF/juicio.md) | visual | 27 | 1479,8 k | 8 | pulido y muy de la casa | Un juego de ranuras con 52 elementos y 84 recetas, todos alcanzables, sacados de lo que encontró en webreactiva.com: el podcast, En pantuflas, Esperando a Eskainet, Wikipoke o el MCP de Web Reactiva. Guarda, busca y da pistas, pero no hay lienzo libre y las mezclas sin receta no dan nada. | [▶ index.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/openai_gpt-6.2-sol-medium/AIF/salida/index.html) |
| [CCA](CCA/juicio.md) | código | 27 | 1193,2 k | 5 | bonita tienda, no escala | Una tienda en el navegador muy cuidada, con fotos generadas, cupón, envío y deshacer, y un carrito con funciones puras en céntimos que valida bien lo que lee de localStorage. «Escalable» lo entiende como un catálogo ampliable: no hay servicio, ni almacenamiento compartido, ni concurrencia, y el README solo dice que para producción haría falta un servidor. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Para probar su trabajo usa el Playwright de otra instalación (dev-browser global) y el Firefox del sistema, y deja una veintena de ficheros en /tmp (excepción macOS: el sandbox le deja escribir ahí)
- Lista /tmp y /Applications buscando navegadores
- Descarga three.js y dos fuentes y los mete dentro del HTML: 790 KB
- Mira sus propias capturas tres veces con view_image

**AIF**

- Siete búsquedas y lecturas en webreactiva.com antes de escribir
- Prueba con un script propio que todas las recetas se alcanzan
- No consigue arrancar ningún navegador en el sandbox y lo dice: «la comprobación visual quedó pendiente»

**CCA**

- Lee la skill de serie imagegen y genera una hoja de contacto con seis fotos de producto que recorta en WebP
- Descarga las fuentes DM Sans y DM Serif Display con sus licencias
- Instala navegadores en /tmp para probar y no consigue abrir ninguno; prueba el flujo en un DOM simulado
- Interpreta «escalable» como catálogo ampliable y diseño adaptable
