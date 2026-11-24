# Rúbricas

Cada prompt se puntúa sobre 10 con estos criterios, y la nota es la suma. El juez comprueba cada criterio de verdad (lo abre, lo juega, lo ejecuta en una copia) y apunta el desglose en `juicio.json → rubrica`. Si no hay entregable, es un 0.

MWP (Mermaid de la arquitectura de Wikipedia) se retiró el 20 nov. 2026: casi todos los modelos sacaban un 8 o un 9 y no los distinguía. Sus resultados están en `resultados/_retirados/`.

PTS (post sobre los tests que fallan a veces) se retiró el 23 nov. 2026: al autor no le parece un benchmark interesante y es difícil de evaluar. Su rúbrica, sus notas y el motivo están en `resultados/_retirados/PTS.md`.

## A3D · Una ruta en 3D en la Alhambra de Granada en un solo fichero html

| Criterio | Puntos |
|---|---:|
| Un solo HTML que abre y funciona sin errores de consola | 1 |
| Hay una ruta con paradas reales de la Alhambra, en un orden de visita creíble | 2 |
| La ruta se recorre: la cámara viaja de una parada a otra (a mano o en automático) | 3 |
| Se reconoce la Alhambra sin leer las etiquetas: 2 si se ven tres o más elementos propios (arco de la Justicia, patio circular de Carlos V, Leones, estanque de Arrayanes, acequia del Generalife, torres de la Alcazaba, Sierra Nevada); 1 si uno o dos | 2 |
| Vista limpia: la cámara no atraviesa muros, nada tapa la escena, las etiquetas se leen | 1 |
| Los textos de las paradas no tienen errores | 1 |

## AIF · Juego de alquimia como Infinite Craft con el contenido de Web Reactiva, en un único HTML

| Criterio | Puntos |
|---|---:|
| Un solo HTML que abre y funciona sin errores de consola | 1 |
| Mecánica de Infinite Craft: 2 si se arrastra un elemento sobre otro en un lienzo; 1 si se combina en ranuras o calderos | 2 |
| Las combinaciones básicas funcionan al jugar | 2 |
| Progresión: el 90 % o más de los elementos se puede alcanzar desde los iniciales | 1 |
| «Infinito»: las mezclas sin receta también dan algo | 1 |
| Contenido de Web Reactiva de verdad (sus temas, su comunidad, su voz): 2; solo el nombre: 0 | 2 |
| Acabado: guarda el progreso, busca, da pistas | 1 |

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

Es exigente a propósito: usa la métrica y la regla de cruce de RealVuln. Un hallazgo acierta si da el mismo fichero, una línea en el rango ±10 (un rango de líneas vale si toca esa ventana y no abarca más de 20) y una clase equivalente a un CWE aceptado, que decide el juez por la descripción (un acierto sin número de línea vale medio: RealVuln lo acepta entero, pero en texto libre bastaría con nombrar el fichero); todo lo que no acierta es falso positivo, **aunque sea un fallo real sin etiquetar** (se apunta aparte como `EXTRA`).

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
| Superficie (app, CLI, extension, codex-web, iOS): 2 si ≥ 90 %, 1 si ≥ 85 % | 2 |
| Áreas, F1 global: 3 si ≥ 0,75, 2 si ≥ 0,65, 1 si ≥ 0,55 | 3 |
| **Eficiencia** | **4** |
| Tokens de toda la sesión (entrada, salida y caché): 2 si ≤ 600 000, 1 si ≤ 900 000 | 2 |
| Tiempo de la sesión: ≤ 150 s | 1 |
| Peticiones al modelo: ≤ 10 | 1 |

La eficiencia solo puntúa si la calidad llega a 3 de 6: responder rápido y barato no tiene mérito si la clasificación no sirve. Una incidencia que falta o no se entiende cuenta como fallo en todo. El coste en dólares va aparte, como información (depende del proveedor y de la tarifa).
