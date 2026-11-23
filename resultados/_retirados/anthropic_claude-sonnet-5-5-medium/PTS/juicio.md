# PTS · claude-sonnet-5-5 (medium) · 8/10

**Sólido, con la cuenta mal**

## Validación

- `slop.py`: 1210 palabras, 11 títulos, 12 líneas de lista, frase media de 16,1 palabras, 0,99 marcas por cada 100 palabras: 16 negritas, una lista de seis con etiqueta en negrita, sección «Conclusión» y «la próxima vez que».
- El cierre «Cuéntalo en los comentarios» es una frase de chatbot que la regla del script no caza (busca «cuéntame», «cuéntanos»…). Con su peso de 2 la densidad sube a 1,16: slop 1, no 2.
- Los dos fragmentos de Python son coherentes: `time.sleep(1)` antes de comprobar el estado del pedido y la versión que espera a la condición con límite.
- La cuenta está mal: 0,98^500 = 0,000041, es decir, 0,0041 %. El post escribe «≈ 0,00004 %», cien veces menos.
- Sesión: una llamada a `Write` en su carpeta. `fugas.py` sin hallazgos.

## Lo que está bien

- La tesis tiene mecanismo desde el principio: sin test hay un hueco que se conoce y se compensa con cuidado; un test intermitente aparenta una garantía que no da, y cuando falla de verdad alguien dice «otro flaky» y relanza.
- Se ciñe a los tests intermitentes de principio a fin.
- Explica por qué los reintentos automáticos empeoran el problema: esconden justo los bugs de concurrencia que el test está señalando.
- El ejemplo del `sleep` dice qué verifica de verdad ese test: «que se procese en menos de un segundo en la máquina que toque».
- Plan práctico y concreto: medir la tasa por test, cuarentena con ticket, responsable y fecha, borrar si no se puede arreglar, reproducir en bucle (`go test -count=500 -race`).
- La matización final (un test intermitente a veces es la única señal de un bug real) refuerza la tesis en vez de rebajarla.

## Lo que falta o está mal

- El número del ejemplo de la cuenta es incorrecto, y además el supuesto (500 tests, todos con un 2 % de fallo) es irreal; no hacía falta exagerarlo para que la idea se sostuviera.
- El caso de entrada es la escena genérica del «Re-run», no un incidente contado.
- Formato de manual: lista con etiquetas en negrita, lista numerada de seis pasos, «Conclusión» y pregunta al lector para los comentarios.
- El título de sección «Un test sin test es honesto» no se entiende: quería decir «no tener test».

## Rarezas de la sesión

- Dos peticiones y una sola llamada (`Write`): escribe el post de un tirón en 31 s, sin borrador ni relectura.
- Repite el número equivocado en el chat como argumento de venta («con la cuenta de `0.98^500`»).
- Ofrece al final adaptarlo a otro tono o lenguaje, aunque la regla es un mensaje por sesión.
