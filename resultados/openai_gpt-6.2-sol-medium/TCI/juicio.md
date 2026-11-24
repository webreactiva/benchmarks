# TCI · gpt-6.2-sol · 9/10

**Como Opus, a mitad de precio**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`).

| | |
|---|---:|
| Tipo | 97,0 % |
| Superficie | 87,7 % |
| Áreas, F1 global / medio por área | 0,690 / 0,655 |
| Idénticas a jev | 85 de 300 |
| Tiempo · peticiones · tokens | 103 s · 12 · 525 k |
| Coste estimado | ≈ 0,21 $ |

Rúbrica: calidad 6/6 (tipo 1, superficie 2, áreas 3) y eficiencia 3/4 (tokens 2, tiempo 1, peticiones 0).

Áreas más flojas: computer-use 0,38 (19 sin marcar, 1 de más), performance 0,48 (13 de más), rate-limits 0,50 (17 sin marcar), session 0,51 (46 de más).

## Rarezas de la sesión

- Lee las 300 incidencias en tres tandas de 100, recortadas a unos 400 caracteres, y abre completas unas 40 dudosas.
- Clasifica con un código de letras propio (`bc sdtg`: bug, CLI, sandbox, app-server, TUI, config) y lo expande a JSONL con un script: 3651 tokens de salida para 300 incidencias, de los que menos (solo gemini-4-carbon gasta menos).
- Avisa en el chat de lo que decidió: Android como app y bug/app provisional en las incidencias retiradas sin datos.
