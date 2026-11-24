# TCI · ollama/deepseek-v4.1-flash · 9/10

**Casi igual, por un céntimo**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`). Tokens y peticiones incluyen los subagentes.

| | |
|---|---:|
| Tipo | 96,0 % |
| Superficie | 87,3 % |
| Áreas, F1 global / medio por área | 0,667 / 0,634 |
| Idénticas a jev | 70 de 300 |
| Tiempo · peticiones · tokens | 87 s · 15 · 0,86 M |
| Coste estimado (precio de OpenRouter) | ≈ 0,01 $ |

Rúbrica: calidad 6/6 (tipo 1, superficie 2, áreas 3) y eficiencia 3/4 (tokens o coste 2, tiempo 1, peticiones 0).

Áreas más flojas: performance 0,4 (5 sin marcar, 16 de más), computer-use 0,4 (18 sin marcar, 3 de más), config 0,47 (28 sin marcar, 27 de más), model-behavior 0,5 (8 sin marcar, 8 de más).

## Rarezas de la sesión

- Guarda el resultado como classificacion.jsonl (con una s de más); el corrector lo encuentra igual.
- Es el único que iguala la nota de Haiku 5.5, y por menos dinero.
