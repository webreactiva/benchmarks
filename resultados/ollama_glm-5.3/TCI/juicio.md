# TCI · ollama/glm-5.3 · 6/10

**Bien, lento y más caro**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`). Tokens y peticiones incluyen los subagentes.

| | |
|---|---:|
| Tipo | 97,3 % |
| Superficie | 88,7 % |
| Áreas, F1 global / medio por área | 0,608 / 0,623 |
| Idénticas a jev | 71 de 300 |
| Tiempo · peticiones · tokens | 409 s · 13 · 1,3 M |
| Coste estimado (precio de OpenRouter) | ≈ 0,223 $ |

Rúbrica: calidad 5/6 (tipo 1, superficie 2, áreas 2) y eficiencia 1/4 (tokens o coste 1, tiempo 0, peticiones 0).

Áreas más flojas: computer-use 0,39 (18 sin marcar, 4 de más), config 0,41 (37 sin marcar, 6 de más), tool-calls 0,42 (36 sin marcar, 8 de más), app-server 0,49 (50 sin marcar, 3 de más).

## Rarezas de la sesión

- Ninguna destacable: lee las incidencias, clasifica y guarda el resultado.
