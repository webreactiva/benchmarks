# PTS · claude-fable-5-2 · 10/10

**Completo y limpio.**

## Validación

- Un post en Markdown (`tests-intermitentes.md`), en español, de 933 palabras y 7 títulos.
- `slop.py`: 0,8 marcas por cada 100 palabras (10 negritas y una lista de cinco causas con etiqueta). Sin rayas, sin «En resumen» y sin cierres de manual.
- Las cifras cuadran: 0,999^200 ≈ 0,82 (casi uno de cada cinco pipelines falla sin motivo) y 0,999^1000 ≈ 0,37 (falla el 63 %).

## Lo que está bien

- El mecanismo es claro y va primero: sin tests sabes que no tienes información; con un test intermitente tienes «ruido con aspecto de información».
- Explica el daño real como un hábito: el equipo aprende a reintentar, y ese reflejo deja pasar el bug que también es intermitente (una condición de carrera que falla una de cada veinte).
- Trae un ejemplo de código antes y después: un `sleep(1)` contra un reloj inyectado. Agrupa las causas en tiempo, orden, concurrencia, exterior y azar.
- Las recomendaciones son concretas: cuarentena el mismo día, dueño y fecha, arreglar o borrar, desconfiar del reintento automático y medir el historial por commit.
- Cierra con una acción para hoy en lugar de un resumen.

## Lo que falta o está mal

- Poco que reprochar. La lista de causas con etiqueta en negrita es el único tic de formato.
- El fallo del ejemplo del `sleep(1)` («depende de cómo se redondee el reloj») está contado por encima: no dice en qué comparación de tiempos falla.

## Rarezas de la sesión

- Una sola petición con herramienta: escribe el post con un `Write` y no lo relee.
- En la respuesta da la ruta absoluta de la carpeta de trabajo y ofrece adaptar el front matter o el lenguaje del ejemplo.
