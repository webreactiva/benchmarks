# PTS · google/gemini-4-neon · 9/10

**Completo, con tics de formato.** La tesis bien defendida, con escena, cifra y código; el formato delata que es generado.

> Repetido con `SALIDA_MAX=32768`: la primera tirada no pudo empezar porque OpenRouter rechazaba el tope de 65 536 tokens por falta de saldo (`_descartados/google_gemini-4-neon-sin-credito/`). Un post no llega a 4 000 tokens: el tope no cambia nada.

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
- `slop.py`: 1486 palabras, 13 títulos, 1,26 marcas por cada 100 palabras (19 negritas, 7 listas con etiqueta, «En resumen», «La próxima vez que…»).

## Lo que está bien
- El mecanismo: sin tests el equipo sabe que no tiene red y actúa con cuidado; con tests intermitentes aprende a pulsar *Re-run* («que viene el lobo») y el fallo real pasa. Añade que muchos *flaky* destapan condiciones de carrera reales que así se silencian.
- La escena del cambio trivial, la cruz roja y «dale a Re-run» en Slack.
- La cifra es correcta: 20 tests con un 5 % de fallo dan 0,95²⁰ ≈ 36 % de pasar a la primera.
- Código antes y después (`sleep(300)` frente a `findByText`) y qué hacer: cuarentena o borrar, reintentos solo con métrica, estresar los tests nuevos, reloj inyectado, semillas fijas.

## Lo que falta o está mal
- Formato de blog generado: 19 negritas, listas con etiqueta, separadores entre secciones, «En resumen» y cierre con «La próxima vez que…».

## Rarezas de la sesión
- 3 peticiones, 24 000 tokens, 0,09 $.
