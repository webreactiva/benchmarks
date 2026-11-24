# claude-fable-5-2

Agente: Claude Code. Fechas: 2026-11-22 a 2026-11-24.

**Nota media: 8,2 / 10** (4 de 5 prompts juzgados). Total: 31 peticiones y 2687,8 k tokens.

Pendientes: SEC.

| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |
|---|---|---:|---:|---:|---|---|---|
| [A3D](A3D/juicio.md) | visual | 9 | 1149,4 k | 10 | maqueta completa que se recorre | Maqueta de toda la colina de la Sabika con three.js incrustado: diez paradas en orden de visita, de la Puerta de la Justicia al Patio de la Acequia, con un recorrido que camina a ras de suelo por el camino dibujado y sigue solo, minimapa, lista de paradas y luz de día, atardecer y noche. Se reconocen el arco de la Justicia, la Alcazaba, el patio circular de Carlos V, la alberca de Arrayanes con Comares y el Patio de la Acequia, y las fichas son correctas; solo los Leones quedan algo escondidos entre tejados. | [▶ alhambra-ruta-3d.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/anthropic_claude-fable-5-2/A3D/salida/alhambra-ruta-3d.html) |
| [AIF](AIF/juicio.md) | visual | 5 | 290,6 k | 8 | buen juego, poco Web Reactiva | Tablero libre donde se arrastra una ficha sobre otra, 141 elementos y 157 recetas, todos alcanzables desde HTML, CSS, JavaScript, Servidor, Micrófono y Café, con buscador, pista y progreso guardado. El contenido es cultura del desarrollo web en general (frameworks, Docker, «Centrar un div», «Deploy en viernes») con seis elementos de la casa; las mezclas sin receta no dan nada. | [▶ alquimia-reactiva.html](https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main/resultados/anthropic_claude-fable-5-2/AIF/salida/alquimia-reactiva.html) |
| [CCA](CCA/juicio.md) | código | 6 | 295,5 k | 10 | escala de verdad, sin adornos | Servicio HTTP en Node sin estado con los carritos en Redis: cada escritura es un script Lua atómico, así que 50 altas a la vez repartidas entre dos instancias con el mismo Redis guardan las 50; dinero en céntimos, precio siempre del catálogo y validación estricta. Pasa 21 tests contra un Redis real y el README explica cada decisión de escalado, pero el dominio es el mínimo: ni stock, ni descuentos, ni checkout. | – |
| [TCI](TCI/juicio.md) | clasificación | 11 | 952,3 k | 5 | Criterio propio, lento y caro | Tipo 97,3 %, superficie 89,7 % y F1 de áreas 0,63 frente a jev (82 incidencias idénticas). Le costó 190 s, 11 peticiones y 952 k tokens (≈ 1,88 $). | – |

Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.

## Rarezas

**A3D**

- Se hizo capturas con Chrome sin interfaz de cada parada, las miró en hojas de contactos y corrigió encuadres, colores y la cubierta de Carlos V.
- La sesión acabó con dos procesos de capturas aún en segundo plano y el mensaje «Esperando a que termine el lote de capturas»: el lanzador lo dio por terminado y cerró Claude Code. Los últimos cambios sí estaban ya en el HTML; quedaba revisar las paradas 7 a 10.
- Bajó three.js 0.160 de jsDelivr y lo metió dentro del HTML para que funcione sin conexión: 730 KB en un fichero.
- 9 peticiones y 1,15 millones de tokens (950 000 de caché), 87 000 de salida.

**AIF**

- Escribió el juego entero de una vez sin mirar webreactiva.com; luego hizo dos WebFetch (portada y newsletter) solo para corregir dos descripciones: Web Reactiva («cursos y guías para dominar la IA») y la newsletter («12 recursos cada domingo»).
- Comprobó el grafo de recetas con un script y dijo que no lo había probado en un navegador: honesto con lo que no comprobó.
- Avisa de que no es infinito («no hay IA generando resultados») y pone en el pie «Juego no oficial inspirado en los temas del podcast Web Reactiva».
- 5 peticiones y 22 500 tokens de salida: barato para un AIF.

**CCA**

- Miró qué había en la máquina, vio redis-server y lo arrancó para probar contra un Redis real en vez de quedarse con la memoria.
- Los 21 tests pasaron a la primera; luego levantó dos réplicas contra el mismo Redis y comprobó con curl que 40 altas repartidas dejaban 40.
- Dice que no ha probado el Dockerfile ni el docker-compose.
- Entrega node_modules junto al código.
- 3 minutos y 6 peticiones: 20 000 tokens de salida y 295 000 en total (245 000 de caché).

**TCI**

- Resume cada incidencia en unos 260 caracteres y lee los resúmenes con Read; abre completas unas pocas.
- Aplica reglas propias más estrictas que jev: windows-os «solo cuando el problema parece propio de Windows» y deja sin área los avisos de «model at capacity», que jev pone en rate-limits.
