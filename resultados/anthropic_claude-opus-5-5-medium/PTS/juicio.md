# PTS · claude-opus-5-5 (medium) · 8/10

**Completo pero se pasa**

## Validación

- `slop.py`: 1929 palabras, 23 títulos, 27 líneas de lista, frase media de 19,1 palabras, 0,49 marcas por cada 100 palabras: 26 negritas, «clave», sección «Resumen» y «la próxima vez que». Por encima de las 1800 palabras.
- Tres fragmentos de código correctos: `time.sleep(2)` y su arreglo con `wait_until` en Python, y un test de Jest que depende de `new Date()`.
- La cuenta de horas no sale: 10 personas × 5 PR al día × 5 días = 250 pipelines; el 10 % son 25 incidentes de 15 minutos, 6,25 h a la semana. El post dice «unas 12 horas» y «una persona y media a tiempo completo», cuando 12 h serían menos de un tercio de una jornada semanal.
- `@RepeatedTest` de JUnit 5 aparece como reintento automático; repite el test N veces, no reintenta los que fallan.
- Sesión: una llamada a `Write` en su carpeta. `fugas.py` sin hallazgos.

## Lo que está bien

- El mejor argumento de los dos Claude: el test como detector de humo que salta al azar, y la regla implícita «un rojo en la CI no significa que algo esté mal», que no se queda en un test sino que se contagia a toda la suite.
- Cierra el mecanismo con el caso peor: el bug real también es intermitente, se relanza, pasa por casualidad y llega a producción «con todos los tests en verde».
- Insiste en algo que pocos posts dicen: muchos tests intermitentes han encontrado un bug real, y antes de culpar al test hay que sospechar del código.
- Se ciñe a los tests intermitentes. Caso de entrada concreto (viernes a las seis, `test_checkout_sends_confirmation_email`, «Re-run failed jobs»), código y números.
- La parte práctica es útil: tres salidas (arreglar, cuarentena, borrar), cuarentena con dueño, plazo y lista visible, reintentos solo si quedan registrados, orden aleatorio con `pytest-randomly`, `-shuffle` y `--order=rand`.

## Lo que falta o está mal

- Largo: 1929 palabras y 23 títulos para un post. La parte de causas y la de qué hacer se leen como una guía, y el «Resumen» final repite el post en viñetas.
- La cuenta de horas está mal por el doble, y la equivalencia en personas a tiempo completo no tiene nada que ver con el número que da.
- `@RepeatedTest` no es un mecanismo de reintento.
- Llama «falsos negativos» a los fallos sin bug; lo habitual es llamarlos falsos positivos.

## Rarezas de la sesión

- Dos peticiones y una sola llamada (`Write`) en 59 s; 5,5 k tokens de salida, la mitad más que Sonnet para el mismo encargo.
- Añade cabecera YAML (título, fecha, etiquetas, descripción) que nadie le pidió, pensando en un generador de blogs estáticos.
- Ofrece al final acortarlo o cambiar el tono, aunque la regla es un mensaje por sesión.
