# TCI · ollama/muse-spark-open · 5/10

**Bien, el más caro**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`). Tokens y peticiones incluyen los subagentes.

| | |
|---|---:|
| Tipo | 96,0 % |
| Superficie | 85,0 % |
| Áreas, F1 global / medio por área | 0,627 / 0,629 |
| Idénticas a jev | 73 de 300 |
| Tiempo · peticiones · tokens | 237 s · 75 · 6,84 M |
| Coste estimado (precio de OpenRouter) | ≈ 1,937 $ |

Rúbrica: calidad 5/6 (tipo 1, superficie 2, áreas 2) y eficiencia 0/4 (tokens o coste 0, tiempo 0, peticiones 0).

Áreas más flojas: tool-calls 0,26 (44 sin marcar, 2 de más), config 0,28 (43 sin marcar, 3 de más), computer-use 0,38 (19 sin marcar, 1 de más), app-server 0,49 (49 sin marcar, 6 de más).

## Rarezas de la sesión

- Reparte el trabajo entre 3 subagentes, que gastan 1,8 M de los 6,8 M tokens y 38 de las 75 peticiones.
