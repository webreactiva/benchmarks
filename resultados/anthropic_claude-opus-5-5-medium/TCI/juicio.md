# TCI · claude-opus-5-5 · 6/10

**Mejor en áreas, caro**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`).

| | |
|---|---:|
| Tipo | 97,0 % |
| Superficie | 87,7 % |
| Áreas, F1 global / medio por área | 0,668 / 0,641 |
| Idénticas a jev | 86 de 300 |
| Tiempo · peticiones · tokens | 125 s · 12 · 768 k |
| Coste estimado | ≈ 0,79 $ |

Rúbrica: calidad 4/6 (tipo 1, superficie 1, áreas 2) y eficiencia 2/4 (tokens 1, tiempo 1, peticiones 0).

Áreas más flojas: config 0,37 (39 sin marcar, 5 de más), computer-use 0,38 (19 sin marcar, 1 de más), tool-calls 0,39 (39 sin marcar, 2 de más), remote 0,49 (12 sin marcar, 9 de más).

## Rarezas de la sesión

- Resume cada incidencia en unos 450 caracteres con un script y abre completas cinco dudosas.
- Escribe la clasificación en un formato abreviado (51098|b|CLI|…) y la convierte a JSONL con un script: la mitad de tokens de salida que Haiku.
