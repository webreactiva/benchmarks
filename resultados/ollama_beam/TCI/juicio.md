# TCI · ollama/beam · 6/10

**Rápido, áreas justas**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`). Tokens y peticiones incluyen los subagentes.

| | |
|---|---:|
| Tipo | 96,0 % |
| Superficie | 88,0 % |
| Áreas, F1 global / medio por área | 0,596 / 0,601 |
| Idénticas a jev | 62 de 300 |
| Tiempo · peticiones · tokens | 107 s · 18 · 1,76 M |
| Coste estimado (precio de OpenRouter) | ≈ 0,138 $ |

Rúbrica: calidad 4/6 (tipo 1, superficie 2, áreas 1) y eficiencia 2/4 (tokens o coste 1, tiempo 1, peticiones 0).

Áreas más flojas: computer-use 0,38 (19 sin marcar, 1 de más), model-behavior 0,41 (8 sin marcar, 15 de más), config 0,43 (36 sin marcar, 7 de más), app-server 0,46 (52 sin marcar, 3 de más).

## Rarezas de la sesión

- Ninguna destacable: lee las incidencias, clasifica y guarda el resultado.
