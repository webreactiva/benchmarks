# ollama/glm-5.3-flash

Agente: OpenCode. Fechas: 2026-11-19 a 2026-11-20.

**Nota media: 8,5 / 10** (4 de 4 prompts juzgados). Total: 69 peticiones y 3186,1 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio |
|---|---|---:|---:|---:|---|---|
| [A3D](A3D/juicio.md) | visual | 29 | 1822,9 k | 9 | se recorre y se reconoce | Ruta guiada a pie de calle que arranca sola y avanza por 8 puntos (Justicia, Vino, Alcazaba, Carlos V, Leones, Arrayanes y Comares, Generalife) más un modo libre con una de las mejores maquetas del benchmark: la Torre de Comares, Carlos V con su patio circular, el anillo de columnas de los Leones, la Alcazaba almenada y el Darro. Pero empieza dentro de un muro y en el recorrido la cámara roza las paredes. |
| [AIF](AIF/juicio.md) | visual | 4 | 250,7 k | 8 | buen juego, Web Reactiva inventado | Mecánica muy fiel a Infinite Craft (mesa infinita con zoom, soltar una ficha sobre otra, panel de descubrimientos con buscador, sonidos), 145 recetas todas alcanzables y un generador de «invenciones raras» para las mezclas sin receta. Pero el contenido de Web Reactiva es inventado: «Nacho Ojea», «Trece Tigres», «La Red», ZX Spectrum y GeoCities; parte de Internet, Radio, Cine y Juego. |
| [CCA](CCA/juicio.md) | código | 33 | 1083,0 k | 8 | bien diseñado, Redis roto | Python con capas (dominio, aplicación, infraestructura, API HTTP), Decimal para el dinero, precios del catálogo, bloqueo por carrito en memoria, límites y 24 tests en verde. Pero el adaptador de Redis, que es lo que lo haría escalar, captura self._client.WatchError, que no existe: un conflicto de concurrencia o cualquier error de negocio acaba en AttributeError. |
| [PTS](PTS/juicio.md) | texto | 3 | 29,6 k | 9 | el mejor post | 981 palabras con la tesis bien defendida (sin tests sabes que no hay red; con tests que mienten crees que la hay), costes con números (un test que falla 1 de cada 50 con 100 ejecuciones al día interrumpe a diario), un ejemplo en Go, las causas típicas y cinco pasos. El menos slop de todos. Falla en el ejemplo: dice que pasa el 99 % y casi siempre fallará. |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché).

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

**CCA**

- 33 peticiones y 1,08 millones de tokens. Fue y vino con los tests varias veces hasta ponerlos en verde, y arrancó el servidor y lo probó con curl.
- Dejó __pycache__ y .pytest_cache en la carpeta de entrega.
- Los tests del adaptador de Redis no existen: la pieza rota es justo la que no probó.
- Añadir un producto que ya está en el carrito no suma: da DuplicateProductError y pide usar PATCH.

**PTS**

- Único post con código: un test en Go con una goroutine sin sincronizar.
- Se equivoca justo en el ejemplo: sin sincronizar, la goroutine casi nunca termina antes de repo.Get, así que el test fallará casi siempre, no pasará «el 99 % de las veces».
- «El efecto del lobo cibernético» como título de sección: traducción rara de «gritar que viene el lobo».
- 3 peticiones y 2,6 k tokens de salida.
