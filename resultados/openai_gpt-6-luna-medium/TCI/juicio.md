# TCI · gpt-6-luna · 0/10

**Regex en vez de leer**

## Validación

`python3 scripts/tci/puntuar.py` contra la clasificación de jev-1.14.0 (`juez/puntuacion.json`).

| | |
|---|---:|
| Tipo | 90,0 % |
| Superficie | 75,3 % |
| Áreas, F1 global / medio por área | 0,390 / 0,411 |
| Idénticas a jev | 4 de 300 |
| Tiempo · peticiones · tokens | 57 s · 8 · 247 k |
| Coste estimado | ≈ 0,007 $ |

Rúbrica: calidad 0/6 (tipo 0, superficie 0, áreas 0) y eficiencia 0/4: con un F1 de áreas por debajo de 0,50 la eficiencia no cuenta.

Áreas más flojas: model-behavior 0,10 (183 de más), performance 0,15 (123 de más), session 0,23 (199 de más), auth 0,23 (135 de más).

## Rarezas de la sesión

- Hace cat del fichero entero y lista títulos y 180 caracteres de cada incidencia, pero no clasifica lo que lee: escribe un clasificador de expresiones regulares por palabras clave (`windows|powershell|wsl…`, `sandbox|permission|approval…`) y lo aplica a las 300.
- Las reglas marcan áreas de más en casi todas: 183 falsos model-behavior, 199 session, 135 auth y 123 performance.
- Lo primero que busca es un AGENTS.md en la carpeta.
- Solo comprueba la forma del resultado (300 ids únicos, valores permitidos), no si la clasificación tiene sentido.
