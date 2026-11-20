# PTS · ollama/minimax-m3 · 8/10

**Un ensayo, no un post.** Tiene más ideas buenas que ningún otro, y se le escapan errores dentro de sus propios ejemplos.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 1 |
| ejemplos concretos | 2 |
| sin errores ni inventos | 0 |
| slop | 2 |
| extensión | 0 |
| **Total** | **8** |

## Medidas (`scripts/slop.py`)
- 2800 palabras (casi el triple que GLM o Haiku), 19 títulos, frase media de 22 palabras.
- Slop 26,8 puntos, 1,0 por cada 100 palabras: 43 negritas, 8 rayas, emojis ❌ ✅ en el código y listas con etiqueta en negrita.

## Lo que está bien
- **La cuenta**: con 1000 tests al 95 % de fiabilidad, la suite sale verde el 0,6 % de las veces. Explica en una línea por qué el rojo se vuelve normal.
- Tabla «sin tests / suite roja crónica / suite fiable» con latencia, coste y capacidad de refactorizar.
- Código en TypeScript con el antes y el después (tiempo inyectado, `waitFor` en lugar de `sleep`) y los tests que pasan sin probar nada.
- Política concreta: niveles de suite (smoke, rápidos, E2E no bloqueante), cuarentena con caducidad, mutation testing.

## Lo que falla
- **Demasiado largo** para un post de blog: 8 secciones, un «bonus» y frontmatter.
- **Errores en sus ejemplos**: el «test que depende del reloj real» usa `clock.setSystemTime`, que es el arreglo; dice que el 5 % de los tests es intermitente y luego calcula como si cada test fallara el 5 %; llama «flake rate» a la tasa de fallo.
- Frases rotas: «se silencian o se silencian», «Comparte el coste de un test…», «alerta por fatiga».

## Rarezas de la sesión
- Buscó en su propio texto palabras en inglés para limpiarlas, como en A3D: se le cuelan.
- Frontmatter YAML de blog que nadie pidió.
- 6 peticiones y 11 k tokens de salida.
