# TCI · claude-haiku-5-5 · 7/10

**Casi igual, por céntimos**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`).

| | |
|---|---:|
| Tipo | 96,3 % |
| Superficie | 85,7 % |
| Áreas, F1 global / medio por área | 0,617 / 0,599 |
| Idénticas a jev | 63 de 300 |
| Tiempo · peticiones · tokens | 113 s · 8 · 499 k |
| Coste estimado | ≈ 0,03 $ |

Rúbrica: calidad 3/6 (tipo 1, superficie 1, áreas 1) y eficiencia 4/4 (tokens 2, tiempo 1, peticiones 1).

Áreas más flojas: computer-use 0,28 (21 sin marcar, 0 de más), app-server 0,34 (59 sin marcar, 4 de más), performance 0,35 (8 sin marcar, 7 de más), tool-calls 0,48 (32 sin marcar, 11 de más).

## Rarezas de la sesión

- Clasifica con un script que resume cada incidencia en el título y 150 caracteres; lo dice en su respuesta («el título y el inicio de cada texto, no el cuerpo completo»). Por eso falla windows-os y sandbox cuando el dato está más abajo, en la plantilla.
- Añade un campo «nota» a 29 incidencias que le parecen retiradas, duplicadas o vacías.
