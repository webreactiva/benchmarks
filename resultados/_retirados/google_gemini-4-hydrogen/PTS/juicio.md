# PTS · google/gemini-4-hydrogen · 9/10

**Claro y útil, algo de slop.** La tesis bien explicada, con código y números; el formato delata que es generado.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 1 |
| ejemplos concretos | 2 |
| sin errores ni inventos | 1 |
| slop | 1 |
| extensión | 1 |
| **Total** | **9** |

## Validación
- `slop.py`: 1220 palabras, 12 títulos, 1,54 marcas por cada 100 palabras (19 negritas, 5 listas con etiqueta, 4 rayas, «En resumen», «La próxima vez que…»).

## Lo que está bien
- El mecanismo, explicado dos veces: sin tests el equipo sabe que va a ciegas y actúa con cautela; con tests intermitentes cree que tiene red, aprende a pulsar *re-run* («Pedro y el lobo») y el fallo real llega a producción con todos los checks en verde.
- Ejemplos concretos: el `sleep(100)` que en un contenedor de CI tarda 120 ms; un pipeline de 15 minutos con un 10 % de fallo aleatorio; el test que falla una de cada veinte por una condición de carrera real.
- Causas típicas (esperas fijas, reloj, estado compartido, servicios externos) con su alternativa, y qué hacer: cuarentena o borrar, medir reintentos, reproducir en bucle.

## Lo que falta o está mal
- Formato de blog generado: 19 negritas, listas con etiqueta en negrita, separadores entre todas las secciones, «En resumen» y cierre con «La próxima vez que…».

## Rarezas de la sesión
- 4 peticiones, 32 000 tokens, 0,05 $: leyó la carpeta, escribió el post y terminó.
