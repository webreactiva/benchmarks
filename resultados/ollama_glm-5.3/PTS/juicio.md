# PTS · ollama/glm-5.3 · 8/10

**Buen argumento, descuidado.** La tesis bien defendida, con código y números, y varias erratas y un invento.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 1 |
| ejemplos concretos | 2 |
| sin errores ni inventos | 0 |
| slop | 1 |
| extensión | 1 |
| **Total** | **8** |

## Validación
- `slop.py`: 1296 palabras, 8 títulos, 1,39 marcas por cada 100 palabras (20 negritas, 9 listas con etiqueta, sección «Conclusión»).

## Lo que está bien
- El mecanismo: sin tests el equipo sabe que no tiene red y va con cuidado; con tests intermitentes aprende a pulsar *retry* y el fallo real pasa como «el de siempre». «Nadie puede ignorar una alarma que no suena».
- Añade un ángulo propio: la cobertura que miente («prefiero un 60 % honesto que un 90 % adornado»).
- Código antes y después (`sleep(2000)` frente a esperar la condición), números del coste y causas típicas con qué hacer: arreglar o borrar, repetir en bucle, cuarentena con fecha de caducidad.

## Lo que falta o está mal
- Erratas: «cuarenta» por «cuarentena» dos veces, «Pensa» por «Piensa».
- El cuento es de un pastor, no de un «guardia de seguridad del pueblo».
- `flake8-ignore-comments` no existe como forma de silenciar tests (flake8 es un linter de Python).
- Formato de blog generado: 20 negritas, listas con etiqueta, «Conclusión».

## Rarezas de la sesión
- 2 peticiones y 16 000 tokens: escribió el post de una vez y terminó.
