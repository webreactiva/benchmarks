# TCI · ollama/mistral-large-4 · 6/10

**Bien, el más lento**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`). Tokens y peticiones incluyen los subagentes.

| | |
|---|---:|
| Tipo | 97,0 % |
| Superficie | 87,7 % |
| Áreas, F1 global / medio por área | 0,613 / 0,61 |
| Idénticas a jev | 71 de 300 |
| Tiempo · peticiones · tokens | 424 s · 14 · 1,21 M |
| Coste estimado (precio de OpenRouter) | ≈ 0,24 $ |

Rúbrica: calidad 5/6 (tipo 1, superficie 2, áreas 2) y eficiencia 1/4 (tokens o coste 1, tiempo 0, peticiones 0).

Áreas más flojas: tool-calls 0,29 (43 sin marcar, 1 de más), config 0,36 (40 sin marcar, 3 de más), computer-use 0,4 (18 sin marcar, 3 de más), model-behavior 0,44 (8 sin marcar, 12 de más).

## Rarezas de la sesión

- Ninguna destacable: lee las incidencias, clasifica y guarda el resultado.
