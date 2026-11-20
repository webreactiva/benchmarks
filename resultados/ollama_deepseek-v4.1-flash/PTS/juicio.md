# PTS · ollama/deepseek-v4.1-flash · 8/10

**Bueno, pero se desvía.** Escribe bien y argumenta mejor que la media, pero del tema que se le pide habla en una sección de nueve.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 0 |
| ejemplos concretos | 2 |
| sin errores ni inventos | 1 |
| slop | 1 |
| extensión | 1 |
| **Total** | **8** |

## Medidas (`scripts/slop.py`)
- 1426 palabras, 10 títulos, frase media de 15 palabras.
- Slop 19 puntos, 1,3 por cada 100 palabras: 20 negritas, 9 entradas de lista con etiqueta en negrita, «representa un», un «no solo…: es», «La próxima vez que» y sección «Conclusión».

## Lo que está bien
- **Argumentos con mecanismo**: la habituación («una alarma de incendios que suena todo el día»), la fatiga de alarmas de los sistemas de monitorización, el coste de decidir cada vez si el rojo importa.
- Frases que se quedan: «500 tests donde 30 fallan siempre son 470 tests, pero con un 100 % de desconfianza»; el test que congela un bug como «guardián del error».
- Un ejemplo de código (`@pytest.mark.skip(reason="flaky, lo vemos después")`) y por qué engaña a la cobertura.
- Política final clara: arreglar o borrar, y un `skip` siempre con fecha y dueño.

## Lo que falla
- **Se va del tema**: el título habla de «un test que falla» y casi todo el texto trata de tests en rojo permanente, saltados o que verifican lo incorrecto. Los que fallan «a veces» ocupan la sección de tests frágiles.
- Formato de manual: listas con etiquetas en negrita, «Conclusión» que repite lo dicho.
- «costo», «monitoreo», «la falla».

## Rarezas de la sesión
- El post más largo del benchmark.
- 3 peticiones y 2,9 k tokens de salida.
