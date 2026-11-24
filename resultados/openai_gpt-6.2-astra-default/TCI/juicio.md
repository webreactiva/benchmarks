# TCI · gpt-6.2-astra · 10/10

**Lo mismo con un tercio de tokens**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`).

| | |
|---|---:|
| Tipo | 96,3 % |
| Superficie | 87,0 % |
| Áreas, F1 global / medio por área | 0,689 / 0,648 |
| Idénticas a jev | 78 de 300 |
| Tiempo · peticiones · tokens | 92 s · 7 · 190 k |
| Coste estimado | ≈ 0,34 $ |

Rúbrica: calidad 6/6 (tipo 1, superficie 2, áreas 3) y eficiencia 4/4 (tokens 2, tiempo 1, peticiones 1).

Áreas más flojas: computer-use 0,36 (19 sin marcar), app-server 0,48 (50 sin marcar), config 0,48 (33 sin marcar), model-behavior 0,53.

## Rarezas de la sesión

- No lee las incidencias enteras: saca con un script los títulos y las respuestas de versión, superficie y sistema operativo de cada plantilla (125 caracteres si no hay plantilla) y abre 36 dudosas a 460 caracteres.
- Escribe las áreas de las 300 en un bloque de letras (w = windows-os, s = sandbox, a = app-server…) y lo expande con un script que comprueba con assert que hay una por id: 2711 tokens de salida.
- Por tokens es el más barato de los GPT, pero Astra cuesta cuatro veces más por token que Sol: 0,34 $ frente a 0,21 $.
