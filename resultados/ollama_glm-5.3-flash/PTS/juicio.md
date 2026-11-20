# PTS · ollama/glm-5.3-flash · 9/10

**El mejor post del benchmark.** Defiende la tesis del título, la baja a costes concretos y enseña código.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 1 |
| ejemplos concretos | 2 |
| sin errores ni inventos | 0 |
| slop | 2 |
| extensión | 1 |
| **Total** | **9** |

## Medidas (`scripts/slop.py`)
- 981 palabras, 7 títulos, frase media de 18 palabras.
- Slop 7,8 puntos, 0,8 por cada 100 palabras: el más limpio de todos (Haiku 1,5; nemotron 2,2). 15 negritas y una lista con etiquetas en negrita. Sin rayas, sin emojis, sin «Conclusión», sin cierre de chatbot.

## Lo que está bien
- **La tesis, clara**: «Con cero tests, todo el mundo sabe que no hay red de seguridad… Con una suite plagada de flaky tests, la gente cree que hay red, pero no la hay.»
- **Costes con números**: un test que falla 1 de cada 50 en un pipeline que corre 100 veces al día interrumpe a alguien casi a diario; un pipeline de 10 minutos con tres reintentos entrega en media hora.
- **Código**: un test en Go con una goroutine sin sincronizar, y la lista de causas (tiempo, estado compartido, mundo exterior, entorno).
- Cinco pasos útiles: medir, cuarentena, reparar o borrar, no normalizar el reintento, prevenir con reloj inyectable y fixtures por test.
- Cierre con frase propia: «un test a veces verde y a veces rojo… es ruido calibrado para ahogar la señal».

## Lo que falla
- **El ejemplo dice lo contrario de lo que pasa**: sin sincronizar, `repo.Get` corre casi siempre antes que la goroutine, así que el test fallará casi siempre; no «pasará el 99 % de las veces».
- «El efecto del lobo cibernético», «contexto switch», «Base de datos» con mayúscula.

## Rarezas de la sesión
- 3 peticiones y 2,6 k tokens de salida: barato para lo que da.
