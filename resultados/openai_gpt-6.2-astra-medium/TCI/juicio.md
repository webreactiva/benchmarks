# TCI · gpt-6.2-astra · 9/10

**Bien clasificado, una vuelta de más**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`).

| | |
|---|---:|
| Tipo | 96,3 % |
| Superficie | 88,7 % |
| Áreas, F1 global / medio por área | 0,692 / 0,637 |
| Idénticas a jev | 82 de 300 |
| Tiempo · peticiones · tokens | 102 s · 13 · 477 k |
| Coste estimado | ≈ 0,57 $ |

Rúbrica: calidad 6/6 (tipo 1, superficie 2, áreas 3) y eficiencia 3/4 (tokens 2, tiempo 1, peticiones 0).

Áreas más flojas: computer-use 0,27 (21 sin marcar), context 0,40, auth 0,49, model-behavior 0,53.

## Rarezas de la sesión
- Lee las 300 por tandas con un script que saca de cada plantilla las respuestas (175 caracteres) o los primeros 360 del texto, y abre completas 29 dudosas.
- Anota cada incidencia en una línea de códigos (C = CLI, A = app, E = enhancement, t = TUI, cfg = config…) y la expande a JSONL con un script; corrige a mano cuatro filas antes de escribir: 2947 tokens de salida.
- Más caro que astra con el esfuerzo por defecto: 13 peticiones y 477 k tokens frente a 7 y 190 k, con la misma calidad.
