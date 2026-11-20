# Tests que fallan: a veces son peores que no tener tests

Todos hemos escuchado que los tests son una red de seguridad. Que cada test que escribimos es una promesa de que el código hace lo que debe hacer, y que una suite verde nos deja dormir tranquilos. Pero hay una cara menos comentada de la moneda: un test que falla de forma intermitente, o que lleva semanas en rojo sin que nadie lo mire, puede hacernos más daño que no tener ningún test.

Parece contraintuitivo. Si un test falla, algo está mal, ¿no? Justo por eso importa entender por qué.

## Un test no es solo código: es una señal

Cada test es un instrumento de medición. Cuando está en verde, informa algo: "esto sigue funcionando". Cuando está en rojo, informa algo distinto: "esto dejó de funcionar, o el test está mal, o el entorno cambió, no sabemos cuál".

El problema es que el equipo no reacciona a los instrumentos, reacciona a lo que cree que significan. Y la forma en que un equipo aprende el significado de un test rojo depende de su experiencia con ese test.

## Cómo se aprende a ignorar un test

Pensemos en un caso muy común. Hay un test de integración que, uno de cada cinco días, falla porque depende de un timeout de red demasiado ajustado. Alguien lo ve, piensa "es el de siempre", y vuelve a lanzar el pipeline. A la segunda ejecución pasa. Nadie abre un ticket.

Con el tiempo ocurre algo peor: el equipo empieza a tratar cualquier rojo como ruido. Los mensajes del tipo "¿alguien sabe si esto es real o es el flaky de siempre?" se vuelven rutina. Y entonces llega el fallo real, el que indica una regresión de verdad en el cálculo de facturación, y se pierde entre los demás. Nadie lo investiga a tiempo porque el sistema de alerta lleva meses enseñando a todos a no creerle.

Eso es lo que llamo **normalización del fallo**. Un test que falla sin consecuencias enseña al equipo que los fallos no importan. Y ese aprendizaje no se queda en ese test: se extiende a toda la suite.

## La falsa sensación de seguridad

Sin tests, el equipo sabe que no sabe. Mira el código con más cuidado, hace pruebas manuales, desconfía de sus cambios, pregunta a quien conoce el módulo. La incertidumbre es visible y genera precaución.

Con una suite que falla a ratos y nadie arregla, la incertidumbre se disfraza. Hay "cobertura", hay "pipeline", hay números. Pero esos números dejaron de significar algo. El equipo cree que está protegido cuando en realidad está protegido solo a medias, y no sabe en qué medida.

Como decía alguien en una charla que no recuerdo bien: es mejor saber que no ves, que creer que ves y estar equivocado.

## Otros costes que no se ven en el dashboard

Más allá de la confianza, hay costes concretos:

- **Tiempo de investigación.** Cada fallo falso consume minutos u horas de alguien que tiene que determinar si es real. Multiplicado por meses, es una cantidad absurda de trabajo.
- **Cambio de contexto.** Un fallo intermitente interrumpe a la persona que lo mira y la obliga a reconstruir lo que estaba haciendo.
- **Tests que se comentan o se marcan como `skip`.** Cuando el rojo cansa, la tentación es desactivar el test. Y un `skip` que lleva un año en el código es un test que ya no existe, pero que sigue apareciendo en el informe como si estuviera ahí.
- **Tests que codifican el comportamiento equivocado.** Para que pasen, a veces se ajustan las expectativas a lo que el código hace hoy, aunque no sea lo correcto. El test deja de proteger y empieza a justificar errores.
- **Desconfianza hacia la herramienta.** Cuando el equipo no cree en la suite, deja de escribir tests nuevos. ¿Para qué, si nadie los va a respetar?

## Entonces, ¿mejor no tener tests?

No. Esa conclusión sería un error igual de grande. Lo que hace daño no es el test que falla, sino el test que falla **sin que nadie reaccione**. Un fallo real y bien atendido es exactamente lo que queremos de una suite.

La diferencia está en cómo tratamos los rojos. Algunas prácticas que ayudan:

1. **Un test rojo es una parada, no un ruido.** Si el pipeline está en rojo, la prioridad es volverlo a verde: arreglarlo, o retirar el test con una decisión explícita y registrada.
2. **Los tests inestables se ponen en cuarentena, pero con dueño y plazo.** Moverlos a una suite aparte es razonable. Dejarlos ahí para siempre no lo es.
3. **Medir la inestabilidad.** Si un test falla sin cambios en el código, es un dato. Registrar cuántas veces falla cada test sin motivo permite priorizar qué arreglar primero.
4. **Eliminar lo que no aporta.** Un test que nadie entiende ni confía en él puede borrarse. Borrarlo también es una decisión, y es mejor que mantenerlo como decoración.
5. **Revisar los tests como se revisa el código.** Un test mal escrito, que depende del orden de ejecución o del reloj del sistema, debería rechazarse en code review igual que una función con errores.

## Conclusión

Un test que falla no es malo. Es información. Lo malo es acumular información que nadie lee, que nadie se cree o que nadie tiene tiempo de arreglar. En ese punto, la suite deja de ser una red de seguridad y se convierte en una fuente de falsa tranquilidad.

Así que la próxima vez que un test lleve tres días en rojo y alguien proponga "dejémoslo, ya se verá", recordemos que esa decisión no es neutra. Estamos eligiendo entre arreglar la señal o aprender a ignorarla. Y el segundo camino, a la larga, siempre sale más caro.
