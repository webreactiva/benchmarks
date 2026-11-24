# TCI · ollama/inkling-2-small · 6/10

**Muy bien, muy caro**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`). Tokens y peticiones incluyen los subagentes.

| | |
|---|---:|
| Tipo | 97,3 % |
| Superficie | 89,0 % |
| Áreas, F1 global / medio por área | 0,687 / 0,662 |
| Idénticas a jev | 88 de 300 |
| Tiempo · peticiones · tokens | 284 s · 147 · 5,44 M |
| Coste estimado (precio de OpenRouter) | ≈ 0,614 $ |

Rúbrica: calidad 6/6 (tipo 1, superficie 2, áreas 3) y eficiencia 0/4 (tokens o coste 0, tiempo 0, peticiones 0).

Áreas más flojas: computer-use 0,27 (19 sin marcar, 13 de más), config 0,38 (39 sin marcar, 4 de más), remote 0,5 (12 sin marcar, 8 de más), performance 0,5 (5 sin marcar, 9 de más).

## Rarezas de la sesión

- Reparte el trabajo entre 6 subagentes, que gastan 3,9 M de los 5,4 M tokens y 111 de las 147 peticiones.
- El primer intento se cortó porque el lanzador cerró la sesión mientras los subagentes trabajaban (en _descartados); este es el repetido, con el lanzador que espera.
