He escrito el post en español y lo he guardado en `/tmp/bench-ws/claude-haiku/PTS/tests-que-fallan-peor-que-no-tenerlos.md`.

El argumento central es que un test que falla no es malo en sí: lo dañino es un test que falla sin que nadie reaccione. Eso enseña al equipo a ignorar los rojos, esconde los fallos reales entre los intermitentes y crea una falsa sensación de seguridad, peor que la incertidumbre honesta de no tener tests. El post recorre el coste en tiempo y contexto, los `skip` que se acumulan, los tests que acaban justificando errores, y cierra con prácticas concretas: tratar el rojo como parada, poner en cuarentena los tests inestables con dueño y plazo, medir la inestabilidad y revisar los tests en code review.

Ten en cuenta que la frase "como decía alguien en una charla que no recuerdo bien" es una cita atribuida que no he verificado; conviene quitarla o sustituirla por una fuente real antes de publicar.
