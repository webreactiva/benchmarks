# TCI · ollama/minimax-m3 · 6/10

**Bien, con script propio**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`). Tokens y peticiones incluyen los subagentes.

| | |
|---|---:|
| Tipo | 96,3 % |
| Superficie | 86,3 % |
| Áreas, F1 global / medio por área | 0,617 / 0,621 |
| Idénticas a jev | 54 de 300 |
| Tiempo · peticiones · tokens | 414 s · 25 · 1,76 M |
| Coste estimado (precio de OpenRouter) | ≈ 0,169 $ |

Rúbrica: calidad 5/6 (tipo 1, superficie 2, áreas 2) y eficiencia 1/4 (tokens o coste 1, tiempo 0, peticiones 0).

Áreas más flojas: config 0,4 (32 sin marcar, 29 de más), performance 0,41 (6 sin marcar, 11 de más), computer-use 0,42 (18 sin marcar, 1 de más), tool-calls 0,44 (30 sin marcar, 27 de más).

## Rarezas de la sesión

- Escribe un classify.py y clasifica con él (lo deja en salida/).
