# Rúbricas

Cada prompt se puntúa sobre 10 con estos criterios, y la nota es la suma. El juez comprueba cada criterio de verdad (lo abre, lo juega, lo ejecuta en una copia) y apunta el desglose en `juicio.json → rubrica`. Si no hay entregable, es un 0.

MWP (Mermaid de la arquitectura de Wikipedia) se retiró el 20 nov. 2026: casi todos los modelos sacaban un 8 o un 9 y no los distinguía. Sus resultados están en `resultados/_retirados/`.

PTS (post sobre los tests que fallan a veces) se retiró el 23 nov. 2026: al autor no le parece un benchmark interesante y es difícil de evaluar. Su rúbrica, sus notas y el motivo están en `resultados/_retirados/PTS.md`.

## A3D · Una ruta en 3D en la Alhambra de Granada en un solo fichero html

| Criterio | Puntos |
|---|---:|
| Un solo HTML que abre y funciona sin errores de consola | 1 |
| Hay una ruta con paradas reales de la Alhambra, en un orden de visita creíble y con el Patio de los Leones como parada (sin Leones, como mucho 1) | 2 |
| La ruta se recorre: la cámara viaja de una parada a otra (a mano o en automático) | 2 |
| Se reconoce la Alhambra sin leer las etiquetas: 2 si se ven tres o más elementos propios (arco de la Justicia, patio circular de Carlos V, Leones, estanque de Arrayanes, acequia del Generalife, torres de la Alcazaba, Sierra Nevada); 1 si uno o dos | 2 |
| Vista limpia y volumen real: edificios cerrados y con volumen (no cajas ni planos sueltos), la cámara no atraviesa muros, nada tapa la escena, la vista tiene buen tamaño y las etiquetas se leen. 2 si todo; 1 si falla una cosa | 2 |
| Los textos de las paradas no tienen errores | 1 |

**Tope:** si no se reconoce la Alhambra (0 en ese criterio), la nota es como mucho un 3, aunque la ruta funcione. Unas cajas con una ruta no son una visita a la Alhambra.

Rúbrica revisada el 24 nov. 2026: la anterior daba 7 puntos a abrir, tener paradas, recorrerlas y escribir bien, y una maqueta de cajas sacaba un 7. Los A3D ya juzgados no se vuelven a lanzar ni a juzgar: conservan el desglose antiguo, y donde el autor no estaba de acuerdo manda su nota (`juicio.json → autor`).

## AIF · Juego de alquimia como Infinite Craft con el contenido de Web Reactiva, en un único HTML

El juego de origen es un tapiz: un tablero libre donde sacas tantas tarjetas como quieras de la lista y combinas arrastrando una sobre otra. Poner un elemento en cada una de dos cajitas para generar otro no es Infinite Craft. El prompt no lo explica, pero el modelo tendría que haberlo investigado.

| Criterio | Puntos |
|---|---:|
| Un solo HTML que abre y funciona sin errores de consola | 1 |
| Mecánica de tapiz: tablero libre, tarjetas que se sacan sin límite y se combinan arrastrando una sobre otra. Si combina en ranuras, calderos o cajitas: 0 | 2 |
| Se puede jugar: las combinaciones funcionan al jugar. Si los conceptos no se combinan: 0 | 3 |
| Contenido de Web Reactiva de verdad: 2 si sale el podcast y la inteligencia artificial (o lo que tiene que ver con ellos); 1 si solo tira de «web», «reactiva» y programación en general; 0 si no tiene temática tecnológica | 2 |
| Progresión e «infinito»: casi todo se alcanza desde los elementos iniciales y las mezclas sin receta también dan algo | 1 |
| Acabado: guarda el progreso, busca, da pistas | 1 |

Rúbrica revisada el 24 nov. 2026: la anterior daba 1 punto a las ranuras y solo 2 a que se pudiera jugar. Los AIF ya juzgados no se vuelven a lanzar ni a juzgar: conservan el desglose antiguo, y donde el autor no estaba de acuerdo manda su nota (`juicio.json → autor`).

## CCA · Implementa un carrito de la compra escalable

Se prueba en una copia con un script del juez (`juez/`): 50 altas a la vez, monedas mezcladas, 0,10 × 3, id con `../`, objeto devuelto mutable.

| Criterio | Puntos |
|---|---:|
| Se instala y se ejecuta (compila, arranca o corre su ejemplo) | 1 |
| Tiene tests y pasan | 1 |
| Dominio completo: añadir, cambiar cantidad, quitar, vaciar, totales | 1 |
| Dinero exacto (enteros o decimal) y sin mezclar monedas | 1 |
| El precio sale del catálogo, no del cliente; valida entradas y límites | 1 |
| Concurrencia: 1 si 50 altas a la vez no pierden datos; 1 más si el diseño aguanta varias instancias (versión optimista u operación atómica en el almacenamiento compartido) y funciona | 2 |
| Escala horizontal: 1 si el servicio no guarda estado; 1 más si hay un almacenamiento compartido real y funciona | 2 |
| Explica sus decisiones de escalado (README) | 1 |

## SEC · Haz una auditoría de seguridad de este proyecto

El agente empieza con una aplicación entera en su carpeta: la tienda Next.js de `realvuln-oss-oopssec-store` (commit `0373cf4`), anonimizada como Quokka Bazaar sin mover ninguna línea (`scripts/sec/`). Corre sin búsqueda web. Se puntúa contra el ground truth público de [RealVuln](https://github.com/kolega-ai/Real-Vuln-Benchmark) (`scripts/sec/ground-truth.json`): 40 entradas puntuables. El juez cruza cada hallazgo del informe a mano en `juez/hallazgos.json` y `python3 scripts/sec/puntuar.py <dir>` calcula la nota.

Es exigente a propósito: usa la métrica y la regla de cruce de RealVuln. Un hallazgo acierta si da el mismo fichero, una línea en el rango ±10 (un rango de líneas vale si toca esa ventana y no abarca más de 20; si abarca más, cuenta como sin línea) y una clase equivalente a un CWE aceptado, que decide el juez por la descripción (un acierto sin número de línea vale medio: RealVuln lo acepta entero, pero en texto libre bastaría con nombrar el fichero); todo lo que no acierta es falso positivo, **aunque sea un fallo real sin etiquetar** (se apunta aparte como `EXTRA`).

| Criterio | Puntos |
|---|---:|
| F3 estricto (`10·TP / (10·TP + FP + 9·FN)`): 7 si ≥ 80, 6 si ≥ 70, 5 si ≥ 60, 4 si ≥ 50, 3 si ≥ 40, 2 si ≥ 30, 1 si ≥ 20 | 7 |
| Cubre al menos 4 de las 6 entradas con CVSS crítico | 1 |
| El 90 % o más de los hallazgos da fichero y línea | 1 |
| El 90 % o más de los hallazgos da su CWE | 1 |

Referencia de RealVuln en este repo: la mejor herramienta (Kolega) tiene F3 79, gpt-6-astra 54 y Sonnet 5 en Claude Code 34,5.

## TCI · Clasifica las incidencias de incidencias.jsonl

El agente recibe en su carpeta 300 incidencias reales del repositorio de Codex de OpenAI (octubre y noviembre de 2026; id, título y texto, sin etiquetas) y el prompt tal cual, sin la frase de destino: el propio prompt dice dónde guardar. Corre sin búsqueda web. La clasificación correcta es la de **jev-1.14.0**, un modelo de decisión que se toma como 100 % correcto (`scripts/tci/correcta-jev.jsonl`; en las áreas, las que tienen probabilidad ≥ 0,5). `python3 scripts/tci/puntuar.py <dir>` acepta cualquier estructura de JSON y calcula la nota.

Mide dos cosas por separado. **Calidad**, contra jev. **Eficiencia**, con umbrales absolutos: jev no entra ahí, porque es un modelo de decisión y no un agente. Así un modelo pequeño que clasifica casi igual de bien gastando mucho menos queda por encima de uno grande. Los umbrales de eficiencia se calibraron con las tres primeras pruebas, en Claude Code; los agentes que releen más contexto en cada petición (OpenCode) pueden necesitar ajustarlos.

| Criterio | Puntos |
|---|---:|
| **Calidad (contra jev)** | **6** |
| Tipo (bug, enhancement, documentation): ≥ 95 % de aciertos | 1 |
| Superficie (app, CLI, extension, codex-web, iOS): 2 si ≥ 85 %, 1 si ≥ 80 % | 2 |
| Áreas, F1 global: 3 si ≥ 0,65, 2 si ≥ 0,60, 1 si ≥ 0,55 | 3 |
| **Eficiencia** | **4** |
| Tokens o coste, lo que le sea más favorable: 2 si ≤ 600 000 tokens o ≤ 0,035 $ (lo que cuesta Haiku 5.5); 1 si ≤ 900 000 tokens o ≤ 0,30 $ | 2 |
| Tiempo de la sesión: ≤ 150 s | 1 |
| Peticiones al modelo: ≤ 10 | 1 |

La eficiencia solo puntúa si la clasificación sirve: tipo ≥ 90 % y F1 de áreas ≥ 0,50 (responder «bug, app, sin áreas» a todo da un 86 % de tipo y 0 de áreas). Va por las cifras y no por los puntos de calidad, para que unas décimas de superficie no se lleven por delante los 4 puntos. Los umbrales de calidad toman como techo lo que consiguen los mejores agentes, no la coincidencia total con jev: jev etiqueta con un criterio que no está en el prompt, y el mejor de los cuatro primeros (Opus 5.5) llega a 0,67 de F1 en áreas y nadie pasa del 90 % en superficie. Se recalibraron el 24 nov. 2026 con esos cuatro resultados; si otro modelo supera ese techo, se suben. Una incidencia que falta o no se entiende cuenta como fallo en todo. El coste se estima con `scripts/tci/precios.json` (o el `coste_usd` de OpenRouter): un agente que relee más contexto, como OpenCode, gasta más tokens, y si aun así cuesta como Haiku no se le penaliza. Los modelos de Ollama Cloud se cobran por suscripción; para compararlos se usa el precio por token del mismo modelo en una API pública, y se apunta de dónde sale.
