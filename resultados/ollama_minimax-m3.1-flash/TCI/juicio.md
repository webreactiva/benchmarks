# TCI · ollama/minimax-m3.1-flash · 6/10

**Bien, con muchas peticiones**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`). Tokens y peticiones incluyen los subagentes.

| | |
|---|---:|
| Tipo | 96,3 % |
| Superficie | 86,7 % |
| Áreas, F1 global / medio por área | 0,61 / 0,606 |
| Idénticas a jev | 57 de 300 |
| Tiempo · peticiones · tokens | 213 s · 30 · 2,22 M |
| Coste estimado (precio de OpenRouter) | ≈ 0,068 $ |

Rúbrica: calidad 5/6 (tipo 1, superficie 2, áreas 2) y eficiencia 1/4 (tokens o coste 1, tiempo 0, peticiones 0).

Áreas más flojas: model-behavior 0,36 (8 sin marcar, 21 de más), config 0,39 (37 sin marcar, 10 de más), tool-calls 0,41 (35 sin marcar, 13 de más), computer-use 0,41 (18 sin marcar, 2 de más).

## Rarezas de la sesión

- Ninguna destacable: lee las incidencias, clasifica y guarda el resultado.
