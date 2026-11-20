# PTS · claude-haiku-5-5 (Claude Code) · 6/10

**Bien.** Es un post que se lee hasta el final y que defiende la tesis con un mecanismo, no con una lista de males.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 0 |
| ejemplos concretos | 1 |
| sin errores ni inventos | 0 |
| slop | 1 |
| extensión | 1 |
| **Total** | **6** |

## Medidas (`scripts/slop.py`)
- 953 palabras, 7 títulos, frase media de 16 palabras.
- Slop 14 puntos, 1,5 por cada 100 palabras (nemotron: 2,2): 12 negritas, una lista de cinco con etiqueta en negrita, «no es solo código: es una señal», sección «Conclusión», «la próxima vez que» y una atribución vaga.
- Sin rayas, sin emojis, sin muletillas tipo «cabe destacar», sin cierre de chatbot.

## Lo que está bien
- **La idea central es buena y está explicada**: un test es una señal; si el rojo no tiene consecuencias, el equipo aprende a no creerle y el aprendizaje se extiende a toda la suite. Lo llama «normalización del fallo».
- **Un caso concreto**: timeout de red ajustado que falla uno de cada cinco días, «es el de siempre», reintento, y el día que falla de verdad una regresión de facturación nadie la mira.
- Responde al «peor que no tener tests»: sin tests el equipo *sabe que no sabe* y va con cuidado; con una suite poco fiable la incertidumbre se disfraza de cobertura.
- Costes que no se suelen contar: `skip` que sigue contando en el informe, tests que se ajustan al comportamiento equivocado.
- Cinco prácticas aplicables: rojo = parada, cuarentena con dueño y plazo, medir la inestabilidad, borrar con decisión, revisar tests en code review.

## Lo que falla
- **Cita inventada**: «Como decía alguien en una charla que no recuerdo bien».
- Ni una línea de código en un blog de programación: el test con `sleep` o con el reloj del sistema se menciona, no se enseña.
- Formato de manual en la parte final: lista con etiquetas en negrita, lista numerada, «Conclusión».
- Mezcla «tests que fallan a veces» con «tests que llevan semanas en rojo», que es otro problema.

## Rarezas de la sesión
- 2 peticiones: escribe el fichero y contesta con un resumen. Sin borradores.
