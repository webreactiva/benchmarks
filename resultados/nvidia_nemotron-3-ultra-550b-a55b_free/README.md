# nvidia/nemotron-3-ultra-550b-a55b:free

Agente: OpenCode. Fechas: 2026-11-19 a 2026-11-19.

**Nota media: 4,3 / 10** (3 de 4 prompts juzgados). Total: 32 peticiones y 591,2 k tokens.

Pendientes: SEC.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 3 | 54,3 k | 6 | funciona, poco Alhambra | Un HTML con three.js que carga, enseña 14 paradas con nombre y un tour animado con cámara que sigue una curva, lista de paradas y teclas. Las paradas y el orden son los de una visita real, pero los edificios son cajas y cilindros sin nada nazarí, la cámara atraviesa los volúmenes y salen dos errores al empezar. | [▶ alhambra-3d-route.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/nvidia_nemotron-3-ultra-550b-a55b_free/A3D/salida/alhambra-3d-route.html) |
| [AIF](AIF/juicio.md) | visual | 4 | 77,3 k | 3 | se ve bien, no se puede jugar | Interfaz muy cuidada (barra lateral con búsqueda, lienzo, ranuras, avisos, exportar), pero el juego está roto: getKey ordena los ids y 35 de las 62 recetas tienen la clave al revés, así que HTML + CSS no da nada y solo se pueden descubrir 4 elementos. 11 recetas usan ingredientes que no existen. De Web Reactiva solo tiene el título: el contenido son tecnologías web genéricas. | [▶ alchemy.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/nvidia_nemotron-3-ultra-550b-a55b_free/AIF/salida/alchemy.html) |
| [CCA](CCA/juicio.md) | código | 25 | 459,6 k | 4 | funciona, pero no escala | Librería TypeScript ordenada (servicio, adaptadores de almacenamiento, bus de eventos) que compila y pasa sus 24 tests. Lo que pedía el prompt, «escalable», no aguanta: 50 peticiones concurrentes al mismo carrito dejan 1 línea, sin TTL, sin control de versiones y dinero en coma flotante. | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- 28 KB de HTML en 3 peticiones y 10 k tokens de salida: lo escribió de una vez, sin abrirlo ni comprobarlo.
- La respuesta dice «14 paradas» y enumera 12; el fichero tiene 14.
- Las «partículas atmosféricas» son cuadrados grises que flotan por toda la escena, también delante de la cámara.

**AIF**

- En el chat dice «80+ recetas»: hay 62, y se pueden alcanzar 4.
- 4 peticiones y 47 KB de HTML sin abrirlo ni probar una sola combinación.
- El contador dice «/ 66 descubiertos», objetivo imposible de alcanzar.

**CCA**

- Es la sesión más larga con diferencia: 25 peticiones y 460 k tokens (82 % lectura de caché) frente a 2 de los otros prompts. Se gastó la mitad del cupo diario gratuito en esta prueba.
- Su primer npm test no compilaba (Product tenía id y el test usaba productId). Lo arregló en el tipo, bien; pero el test de eventos que fallaba lo cambió para que esperase item.quantityChanged en vez de item.updated: ajustó el test al código.
- Intentó un edit con oldString y newString idénticos (error de OpenCode «No changes to apply»).
- Dejó dist/, node_modules/ y un data/carts/persistent-cart-789.json de ejecutar los ejemplos en la carpeta.
- Todo el código, los comentarios y la respuesta están en inglés, aunque el prompt va en español.
