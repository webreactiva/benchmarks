# TCI · claude-sonnet-5-5 · 8/10

**El más rápido, superficie justa**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`).

| | |
|---|---:|
| Tipo | 96,3 % |
| Superficie | 84,3 % |
| Áreas, F1 global / medio por área | 0,628 / 0,59 |
| Idénticas a jev | 78 de 300 |
| Tiempo · peticiones · tokens | 69 s · 9 · 573 k |
| Coste estimado | ≈ 0,29 $ |

Rúbrica: calidad 4/6 (tipo 1, superficie 1, áreas 2) y eficiencia 4/4 (tokens 2, tiempo 1, peticiones 1).

Áreas más flojas: config 0,28 (43 sin marcar, 3 de más), computer-use 0,28 (21 sin marcar, 0 de más), app-server 0,41 (55 sin marcar, 3 de más), tool-calls 0,49 (33 sin marcar, 6 de más).

## Rarezas de la sesión

- Clasifica «a mano» leyendo el título y los primeros 110-260 caracteres de cada incidencia, en bloques de 60, y luego escribe el resultado con un script que comprueba que están las 300.
- Pone los avisos de «Selected model is at capacity» en connectivity (jev, en rate-limits) y lo dice en su respuesta.
- Es el que menos tokens de salida gasta (10 k) y el más rápido (69 s).
