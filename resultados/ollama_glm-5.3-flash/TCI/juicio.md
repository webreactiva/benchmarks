# TCI · ollama/glm-5.3-flash · 6/10

**Bien, pero lento**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`). Tokens y peticiones incluyen los subagentes.

| | |
|---|---:|
| Tipo | 96,3 % |
| Superficie | 87,7 % |
| Áreas, F1 global / medio por área | 0,608 / 0,601 |
| Idénticas a jev | 63 de 300 |
| Tiempo · peticiones · tokens | 348 s · 15 · 1,46 M |
| Coste estimado (precio de OpenRouter) | ≈ 0,072 $ |

Rúbrica: calidad 5/6 (tipo 1, superficie 2, áreas 2) y eficiencia 1/4 (tokens o coste 1, tiempo 0, peticiones 0).

Áreas más flojas: computer-use 0,28 (21 sin marcar, 0 de más), remote 0,34 (17 sin marcar, 2 de más), tool-calls 0,35 (40 sin marcar, 4 de más), config 0,42 (36 sin marcar, 8 de más).

## Rarezas de la sesión

- Ninguna destacable: lee las incidencias, clasifica y guarda el resultado.
