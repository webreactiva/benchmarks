# TCI · claude-fable-5-2 · 3/10

**Criterio propio, lento y caro**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`).

| | |
|---|---:|
| Tipo | 97,3 % |
| Superficie | 89,7 % |
| Áreas, F1 global / medio por área | 0,63 / 0,592 |
| Idénticas a jev | 82 de 300 |
| Tiempo · peticiones · tokens | 190 s · 11 · 952 k |
| Coste estimado | ≈ 1,88 $ |

Rúbrica: calidad 3/6 (tipo 1, superficie 1, áreas 1) y eficiencia 0/4 (tokens 0, tiempo 0, peticiones 0).

Áreas más flojas: computer-use 0,28 (21 sin marcar, 0 de más), tool-calls 0,32 (42 sin marcar, 1 de más), config 0,39 (39 sin marcar, 1 de más), remote 0,44 (14 sin marcar, 6 de más).

## Rarezas de la sesión

- Resume cada incidencia en unos 260 caracteres y lee los resúmenes con Read; abre completas unas pocas.
- Aplica reglas propias más estrictas que jev: windows-os «solo cuando el problema parece propio de Windows» y deja sin área los avisos de «model at capacity», que jev pone en rate-limits.
