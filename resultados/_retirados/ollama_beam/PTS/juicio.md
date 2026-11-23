# PTS · ollama/beam · 7/10

**Un esquema útil más que un post.** 662 palabras que van al grano y no se salen del tema: un test intermitente es información falsa y sin tests al menos «no te mientes»; el test como sensor, la regla de reproducirlo en 5 minutos o borrarlo en 24 horas, siete estrategias y una checklist. Pero es casi un esquema en listas, sin un caso ni código, y mezcla inglés («beats», «un test suite», «Des moralización»).

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 1 |
| ejemplos concretos | 1 |
| sin errores ni inventos | 1 |
| slop | 1 |
| extensión | 0 |
| **Total** | **7** |

## Medidas (`scripts/slop.py`)
- 662 palabras, 9 títulos, 24 líneas de lista, frase media de 13 palabras.
- Slop 8,8 puntos, 1,3 por cada 100 palabras: 11 negritas, una lista con etiquetas, 2 rayas.

## Lo que está bien
- La tesis en dos frases: «No tener test = ausencia de información… al menos no te mientes. Test flaky = información falsa».
- Estrategias concretas: ejecutar cada test nuevo 50 veces en el PR, fijar y mostrar la semilla, reloj falso, cuarentena en un job aparte.

## Lo que falla
- Más listas que prosa, y por debajo de las 700 palabras.
- Spanglish y erratas: «Un suite de 50 tests deterministas beats 500 tests flaky», «Des moralización», «las pipelines».

## Rarezas de la sesión
- 6 peticiones.
