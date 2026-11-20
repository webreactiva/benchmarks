# ollama/inkling-2-small

Agente: OpenCode. Fechas: 2026-11-20 a 2026-11-20.

**Nota media: 8,8 / 10** (4 de 4 prompts juzgados). Total: 82 peticiones y 2963,9 k tokens.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio |
|---|---|---:|---:|---:|---|---|
| [A3D](A3D/juicio.md) | visual | 24 | 1202,2 k | 9 | bonita y se recorre | Maqueta clara del cerro de la Sabika con muralla, Alcazaba con bandera, Comares, Generalife con su alberca, Albaicín, el Darro y Sierra Nevada, 9 paradas con textos correctos y un recorrido automático que viaja de verdad. Pero al bajar a los patios la cámara se mete en los muros, y Comares sale como una torre redonda con cúpula. |
| [AIF](AIF/juicio.md) | visual | 15 | 688,7 k | 9 | se juega, Web Reactiva a medias | Mesa libre con fichas que se combinan soltando una sobre otra, 125 elementos todos alcanzables y un generador para las mezclas sin receta. Parte de Agua, Fuego, Aire y Tierra y mezcla programación genérica (React, Rust, Docker) con algo de Web Reactiva (podcast, masterclass, «Maratón WR», «Membresía WR», «Slow Content»), sin mirar la web. |
| [CCA](CCA/juicio.md) | código | 40 | 1042,4 k | 9 | bien diseñado, sin Redis | API Fastify sin estado en TypeScript, con capas y puertos, dinero en céntimos, precio del catálogo, cupones, IVA, envío, caducidad de carritos y compare-and-set por versión en el repositorio. Compila, pasa 21 tests y 50 altas a la vez no pierden nada. Pero solo trae repositorios en memoria: Redis o Postgres quedan como «pendiente». |
| [PTS](PTS/juicio.md) | texto | 3 | 30,7 k | 8 | limpio y útil, se abre de tema | 1045 palabras con la tesis bien defendida (fatiga de alertas, el rojo que deja de bloquear, «saltar con una red que no sabes si está atada»), un caso concreto de flujo de CI y un plan de salida útil (presupuesto de flakiness, cuarentena con dueño, orden aleatorio, reloj inyectado). Poco slop. Pero reparte el post entre cuatro tipos de test que falla y los intermitentes son solo uno. |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché).

## Rarezas

**A3D**

- Lo probó en Chrome headless en varias paradas y lo retocó con 11 ediciones.
- Buscó navegadores (chromium, puppeteer, playwright) para probarlo; corría encerrado y solo vio lo del sistema.
- 24 peticiones y 1,2 millones de tokens, sin compactaciones.

**AIF**

- Dice «no puedo ver imágenes en este modelo» y comprueba la captura por el DOM. El modelo sí acepta imágenes: es nuestra configuración de OpenCode, que no declara qué entradas admite cada modelo.
- No consultó la web para el contenido.
- 15 peticiones y 689 k tokens.

**CCA**

- Preguntó con la herramienta de preguntas (stack: Node/TS, Python/FastAPI o Java/Spring; alcance) y el lanzador le contestó «Decide tú.». Eligió lo que marcaba como recomendado.
- Hizo un smoke test del flujo completo (crear, añadir, cupón, checkout) contra el servidor.
- 40 peticiones y 1 millón de tokens.

**PTS**

- 3 peticiones y 2,2 k tokens de salida.
