# TCI · google/gemini-4-hydrogen · 6/10

**El mejor en áreas, caro**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`).

| | |
|---|---:|
| Tipo | 96,7 % |
| Superficie | 88,0 % |
| Áreas, F1 global / medio por área | 0,725 / 0,701 |
| Idénticas a jev | 91 de 300 |
| Tiempo · peticiones · tokens | 261 s · 26 · 3.45 M |
| Coste (OpenRouter) | 0,99 $ |

Rúbrica: calidad 6/6 (tipo 1, superficie 2, áreas 3) y eficiencia 0/4.

Áreas más flojas: computer-use 0.43 (17 sin marcar, 4 de más), app-server 0.52 (46 sin marcar, 8 de más), session 0.52 (5 sin marcar, 40 de más), config 0.57 (26 sin marcar, 13 de más).

## Rarezas de la sesión

- Leyó las 300 incidencias por trozos con read y shell, y escribió el resultado con un script de Python.
- OpenRouter por Google AI Studio con SALIDA_MAX=65536, sin un solo corte.
