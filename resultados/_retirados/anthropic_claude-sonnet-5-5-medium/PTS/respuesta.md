He escrito el post y lo he guardado en `/var/tmp/bench/ws-LbTlNHJV/tests-intermitentes-peores-que-no-tener-tests.md`.

La tesis es que un test intermitente (*flaky*) miente: da una falsa sensación de seguridad. Un hueco de cobertura, en cambio, es honesto. Estas son las secciones:

- **Costes reales:** pérdida de confianza en toda la suite, tiempo perdido (con la cuenta de `0.98^500`), reintentos automáticos que esconden bugs de concurrencia y desmoralización del equipo.
- **Causas habituales:** esperas con `sleep`, estado compartido, concurrencia, dependencias externas, fechas y aleatoriedad. Incluye un ejemplo de código antes y después.
- **Qué hacer:** medir, poner en cuarentena con responsable y fecha, arreglar la causa, borrar el test si no se puede arreglar y reproducirlo en bucle.
- **Matiz:** a veces un test flaky es la única señal de un bug real, así que conviene investigarlo en lugar de silenciarlo.

El tono es en primera persona y cercano, y el texto está en Markdown, listo para pegar en cualquier plataforma de blog. Si quieres, lo adapto a otro tono o longitud, o le añado ejemplos en un lenguaje concreto, como Java, JS o Go.
