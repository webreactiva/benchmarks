El post está guardado en `/var/tmp/bench/ws-64MLzwSi/tests-intermitentes.md`, en Markdown y con unas 900 palabras.

Se titula «Un test que falla a veces es peor que no tener test» y defiende que el test intermitente (*flaky*) hace más daño que la falta de tests porque enseña al equipo a ignorar el rojo. El recorrido es este:

- **La señal que miente:** sin tests sabes que no tienes información; con un test intermitente tienes ruido que parece información.
- **El hábito de reintentar:** la fatiga de alarmas hace que una condición de carrera real pase el CI con un par de clics.
- **Las cuentas:** 200 tests con un 99,9 % de fiabilidad cada uno dan una suite que solo pasa limpia el 82 % de las veces.
- **Un ejemplo en Python:** un test con `sleep` y su versión determinista con reloj inyectado, más las cinco causas habituales.
- **Qué hacer:** cuarentena inmediata, dueño y fecha, arreglar o borrar, desconfiar del reintento automático y medir.

El tono es directo y de opinión, pensado para un blog técnico general. Si tu blog necesita cabecera con metadatos (front matter de Jekyll, Hugo, etc.) u otro lenguaje en el ejemplo, dímelo y lo adapto.
