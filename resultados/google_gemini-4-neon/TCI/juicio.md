# TCI · google/gemini-4-neon · 6/10

**Bien clasificado, carísimo**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`). Tokens, peticiones y coste incluyen los subagentes.

| | |
|---|---:|
| Tipo | 96,7 % |
| Superficie | 89,3 % |
| Áreas, F1 global / medio por área | 0,698 / 0,699 |
| Idénticas a jev | 94 de 300 |
| Tiempo · peticiones · tokens | 558 s · 79 · 4,01 M |
| Coste (OpenRouter) | 5,13 $ |

Rúbrica: calidad 6/6 (tipo 1, superficie 2, áreas 3) y eficiencia 0/4.

Áreas más flojas: computer-use 0,41 (18 sin marcar, 2 de más), config 0,45 (35 sin marcar, 7 de más), session 0,52 (6 sin marcar, 37 de más), app-server 0,56 (45 sin marcar, 3 de más).

## Rarezas de la sesión

- Repartió las 300 incidencias en seis subagentes de 50 (57 de sus 79 peticiones y 2,9 M de sus 4,0 M tokens).
- A los ~5 min, con 4,3 $ gastados, el autor le escribió en la sesión «Ve terminando: no lances más subagentes, junta lo que ya tengas clasificado, clasifica tú lo que falte y guarda clasificacion.jsonl cuanto antes». No estaba en el prompt; los subagentes ya lanzados terminaron igual.
- SEC no se lanzó: con lo que gastó en TCI no quedaba saldo en OpenRouter.
- OpenCode apuntaba en meta.json solo el coste de la sesión principal (0,89 $); el real con los subagentes es 5,13 $. Corregido en tokens-subagentes.py.
