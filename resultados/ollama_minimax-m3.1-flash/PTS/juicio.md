# PTS · ollama/minimax-m3.1-flash · 7/10

**Un manual, no un post.** 3011 palabras con muy buen código (test que se «arregla» afirmando lo contrario, reloj congelado, espera activa en lugar de sleep, xfail con strict=True) y un plan por fases para salir de una suite roja. Pero cambia el tema: el título quita el «a veces», casi todo va de tests en rojo permanente y los intermitentes ocupan una sección. Tres veces más largo que un post, 66 negritas y palabras rotas.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 0 |
| ejemplos concretos | 2 |
| sin errores ni inventos | 1 |
| slop | 1 |
| extensión | 0 |
| **Total** | **7** |

## Medidas (`scripts/slop.py`)
- 3011 palabras, 23 títulos, frase media de 20 palabras.
- Slop 40,5 puntos, 1,35 por cada 100 palabras: 66 negritas, 11 rayas, 10 entradas de lista con etiqueta, «robusto» y «fundamental».

## Lo que está bien
- El mejor código de todos los PTS: el test que alguien «arregla» invirtiendo el assert, `@pytest.mark.skip(reason="flaky, arreglar en Q3")`, reloj congelado, `wait_until` con timeout, `xfail(strict=True)` y por qué `strict` importa.
- Tabla del rojo de TDD frente al rojo crónico, y el «presupuesto de rojo» como los error budgets de SRE.

## Lo que falla
- Se va del tema: el título dice «un test que falla», sin el «a veces».
- Demasiado largo para un post, con frontmatter y siete secciones numeradas.
- Palabras rotas: «todos|scale-targeted», «discoverirse», «el suite».

## Rarezas de la sesión
- Se le cuelan palabras de otro idioma, como a MiniMax M3 en su A3D y su PTS: «todos|scale-targeted», «discoverirse».
- 27 ediciones sobre el borrador y 15 peticiones para un post.
- Frontmatter YAML de blog que nadie pidió.
