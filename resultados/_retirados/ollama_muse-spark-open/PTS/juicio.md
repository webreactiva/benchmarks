# PTS · ollama/muse-spark-open · 8/10

**Limpio y corto, pero se va al rojo fijo.** 444 palabras directas y con muy poco slop (0,45 por cada 100 palabras): la tesis en dos frases (sin tests sabes que estás desprotegido; con tests rojos que ignoras crees que estás cubierto), dos imágenes que funcionan (la alarma del coche, quitar la pila al detector de humo), la salida de `npm test` con «3 failed» y cuatro reglas. Pero arranca con tests que «fallan constantemente» y apenas toca los que fallan a veces, y es corto para un post.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 0 |
| ejemplos concretos | 2 |
| sin errores ni inventos | 1 |
| slop | 2 |
| extensión | 0 |
| **Total** | **8** |

## Medidas (`scripts/slop.py`)
- 444 palabras, 9 títulos, frase media de 16 palabras.
- Slop 2 puntos, 0,45 por cada 100 palabras: el más bajo del benchmark. 4 negritas y una «Conclusión».

## Lo que está bien
- «Silenciar un test es como quitar la pila al detector de humo porque pita cuando cocinas.»
- La salida `Tests: 3 failed, 47 passed` con la pregunta: «¿Son los 3 de siempre o hay uno nuevo?».
- Reglas claras: main siempre verde, borrar antes que silenciar, cuarentena con dueño y una semana de plazo.

## Lo que falla
- Cambia el tema en la primera frase: «tests que fallan constantemente y nadie arregla».
- Por debajo de las 700 palabras.

## Rarezas de la sesión
- 3 peticiones y 1,2 k tokens de salida: el post más barato del benchmark.
