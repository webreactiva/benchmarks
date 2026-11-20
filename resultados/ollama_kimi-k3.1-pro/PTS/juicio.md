# PTS · ollama/kimi-k3.1-pro · 10/10

**El mejor post del benchmark.** 1409 palabras sin salirse de los tests intermitentes, con la tesis defendida desde el principio («una habitación a oscuras» frente a «una alarma que suena al azar»), cuatro costes con mecanismo (oculta regresiones, entrena a ignorar el rojo, agranda los cambios, gasta atención), la cuenta bien hecha (200 tests al 99 % → 87 % de ejecuciones con algún fallo) y un plan práctico. El menos slop de todos.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 1 |
| ejemplos concretos | 2 |
| sin errores ni inventos | 1 |
| slop | 2 |
| extensión | 1 |
| **Total** | **10** |

## Medidas (`scripts/slop.py`)
- 1409 palabras, 12 títulos, frase media de 17 palabras.
- Slop 10,8 puntos, 0,8 por cada 100 palabras: 11 negritas, una lista con etiquetas en negrita, «esencial» y «la próxima vez».

## Lo que está bien
- La imagen de entrada lo resume todo: sin tests sabes que puedes tropezar; con tests intermitentes, la alarma que suena al azar te enseña a ignorarla.
- «Un reintento exitoso no demuestra que el código esté bien. Solo demuestra que el test es capaz de pasar, algo que ya sabíamos.»
- Un coste que nadie más cuenta: el test inestable hace que la gente acumule cambios para pasar menos veces por el pipeline, y eso los hace más grandes y arriesgados.
- La cuenta de 1 − 0,99²⁰⁰ ≈ 0,87 está bien y avisa de que supone independencia.
- Plan concreto: guardar la evidencia antes de reintentar, medir, hacerlo reproducible, cuarentena con responsable y fecha, arreglar o borrar.

## Lo que falla
- Ni un bloque de código: los ejemplos (`sleep`, reloj inyectado) se nombran, no se enseñan.
- Lista de causas con etiquetas en negrita.

## Rarezas de la sesión
- 4 peticiones y 3,5 k tokens de salida.
