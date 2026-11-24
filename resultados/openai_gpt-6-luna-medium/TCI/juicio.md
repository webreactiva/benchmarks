# TCI · gpt-6-luna · 4/10

**Rapidísimo y barato, clasifica mal**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`).

| | |
|---|---:|
| Tipo | 86,3 % |
| Superficie | 73,3 % |
| Áreas, F1 global / medio por área | 0,404 / 0,406 |
| Idénticas a jev | 8 de 300 |
| Tiempo · peticiones · tokens | 64 s · 7 · 217 k |
| Coste estimado | ≈ 0,007 $ |

Rúbrica: calidad 0/6 (tipo 0, superficie 0, áreas 0) y eficiencia 4/4 (tokens 2, tiempo 1, peticiones 1). La nota es solo la eficiencia: `puntuar.py` la anula cuando el F1 de áreas baja de 0,50 y da un 0; aquí se cuenta.

Áreas más flojas: performance 0,15 (111 de más), model-behavior 0,17 (93 de más), context 0,19 (87 de más), session 0,21 (208 de más).

## Rarezas de la sesión
- Lee el fichero entero y una lista con título y 220 caracteres de cada incidencia, pero no clasifica lo que lee: escribe un clasificador de expresiones regulares por palabras clave y lo aplica a las 300.
- Las reglas marcan áreas por cualquier mención: la mitad de las incidencias salen con 6 a 16 áreas (jev rara vez pasa de 4), y session aparece en 236 cuando la llevan 29.
- Lo primero que busca es un AGENTS.md en la carpeta. Solo comprueba la forma del resultado (300 ids en orden, valores permitidos), no si la clasificación tiene sentido.
