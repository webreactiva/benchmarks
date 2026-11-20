# Por qué los tests que fallan a veces son peores que no tener tests

Una suite sin tests es una habitación a oscuras: sabes que puedes tropezar. Una suite con tests intermitentes es una habitación con una alarma que suena al azar: al principio corresponde a una señal de peligro, pero con el tiempo aprendes a ignorarla.

Ese es el verdadero problema de los *flaky tests*, esos tests que pasan y fallan sin que nadie haya cambiado el código relevante. No solo dejan de aportar información. Además, consumen tiempo, contaminan decisiones y enseñan al equipo a desconfiar de todas las pruebas, incluidas las que sí funcionan.

La ausencia de tests es una carencia visible. La intermitencia es una carencia disfrazada de cobertura.

## Un test debe reducir incertidumbre, no fabricarla

El valor de un test está en la relación entre su resultado y el estado del software. Si falla, debería aumentar razonablemente nuestra sospecha de que hay un defecto. Si pasa, debería aportar cierta confianza sobre el comportamiento que verifica.

Un test intermitente rompe ese contrato. Cuando aparece en rojo, surgen dos explicaciones: hemos introducido un error o el test ha vuelto a hacer de las suyas. La segunda opción suele ser más cómoda, así que repetimos el pipeline. Si entonces pasa, cerramos el caso y seguimos adelante.

Pero un reintento exitoso no demuestra que el código esté bien. Solo demuestra que el test es capaz de pasar, algo que ya sabíamos.

Con suficientes repeticiones, la pregunta deja de ser «¿qué hemos roto?» y se convierte en «¿cuántas veces hay que ejecutar esto para obtener un check verde?». En ese momento la suite ya no está evaluando el producto: el equipo está aprendiendo a negociar con la suite.

## El coste no es solamente el tiempo perdido

Es tentador medir un test inestable por los minutos que añade a integración continua. Ese coste es real, pero suele ser el menor.

### 1. Oculta regresiones auténticas

Si un test falla una de cada diez veces «porque sí», un fallo genuino puede camuflarse entre los falsos positivos. El desarrollador repite la ejecución, obtiene un verde y publica una regresión con el sello de aprobación del pipeline.

No tener ese test habría dejado un hueco conocido. Tenerlo crea una falsa sensación de que ese hueco está vigilado.

### 2. Entrena al equipo para ignorar alertas

La intermitencia rara vez queda contenida en un único archivo. Cambia los hábitos de quienes trabajan con ella: primero se ignora un test conocido, después cualquier error que se le parezca y, finalmente, cualquier pipeline rojo que pueda arreglarse con otro intento.

Un día falla una prueba distinta, estable y útil. La respuesta automática vuelve a ser repetir. El problema ya no es técnico, sino cultural: el rojo ha dejado de exigir una explicación.

### 3. Hace más lentos los cambios pequeños

Una corrección de una línea puede terminar bloqueada durante media hora por un fallo que no tiene relación con ella. Quien abrió el cambio debe investigar infraestructura ajena, pedir ayuda o convencer a alguien de que su modificación es inocente.

La fricción se repite hasta que publicar deja de ser una rutina y se convierte en una lotería. Entonces llegan los cambios más grandes, con más commits acumulados, precisamente para evitar pasar tantas veces por el pipeline. El test inestable no solo ralentiza la entrega: también empeora su tamaño y su riesgo.

### 4. Desperdicia la atención de quienes depuran

Investigar un fallo no determinista exige reconstruir un contexto que quizá ya no existe: datos de una ejecución anterior, orden de tests, hora del sistema, latencia de red o estado de un servicio externo. Sin registros adecuados, la depuración consiste en lanzar la suite muchas veces y esperar que el problema reaparezca.

Mientras tanto, ese test sigue figurando como cobertura en los informes.

## La métrica engañosa del porcentaje de éxito

Un test que pasa el 99 % de las veces puede parecer bastante fiable. Sin embargo, una suite ejecuta muchas oportunidades de fallo. Si hubiera 200 tests independientes con esa misma tasa de fallo individual, la probabilidad de que al menos uno falle en una ejecución sería aproximadamente del 87 %.

La independencia no siempre se cumple, pero el cálculo ilustra una idea importante: pequeñas inestabilidades se acumulan hasta convertirse en una experiencia diaria. Cada test puede parecer tolerable por separado y, aun así, hacer que el conjunto resulte inservible.

Además, el porcentaje de ejecuciones verdes no mide la propiedad esencial de una suite: que un resultado rojo signifique algo.

## De dónde sale la intermitencia

Los tests inestables no suelen estar poseídos. Sus causas más habituales son bastante concretas:

- **Tiempo real y esperas arbitrarias:** `sleep` que funcionan en una máquina local, pero no en un runner saturado.
- **Concurrencia:** carreras entre procesos, promesas no esperadas o recursos compartidos sin sincronización.
- **Estado residual:** bases de datos, cachés, archivos o variables globales que sobreviven entre pruebas.
- **Dependencias externas:** red, reloj del sistema, zona horaria, generadores aleatorios y servicios de terceros.
- **Orden y paralelismo:** tests que solo pasan si otro se ejecutó antes o si ninguno compite por el mismo recurso.
- **Datos ambiguos:** colecciones sin orden garantizado, identificadores no deterministas o fechas construidas con el momento actual.

Fijarse en estos patrones es útil, pero no basta con conocer la lista. Hace falta una política para actuar cuando aparece el primer fallo inexplicable.

## Qué hacer cuando un test empieza a fallar «a veces»

La peor respuesta es aceptar el reintento como procedimiento normal. Una estrategia más sana puede resumirse así:

1. **Conservar la evidencia.** Guardar logs, semilla aleatoria, trazas, versión del entorno y artefactos del fallo antes de volver a ejecutar. Un reintento no debería borrar la única pista disponible.
2. **Medir su frecuencia y su alcance.** Saber si falla en una rama, en un runner concreto, en paralelo o a determinadas horas suele reducir mucho la búsqueda.
3. **Hacerlo reproducible.** Fijar el reloj, controlar la aleatoriedad, aislar el estado y sustituir esperas de tiempo por condiciones observables.
4. **Aislarlo temporalmente si bloquea al equipo.** La cuarentena debe tener responsable, fecha límite y visibilidad. No es un cementerio de tests ni un permiso para ignorarlos indefinidamente.
5. **Arreglarlo o eliminarlo.** Si nadie puede explicar qué comportamiento protege o el coste de estabilizarlo supera su valor, borrarlo puede ser más honesto que conservarlo.

Los reintentos automáticos pueden servir como mecanismo temporal de contención, nunca como solución. Si se usan, deberían seguir registrando el primer fallo y alimentar una métrica de intermitencia. Ocultar el fallo detrás de un check verde solo privatiza el coste y lo reparte entre quienes lleguen después.

## Estabilidad también es diseño

Prevenir es mejor que perseguir fallos fantasma. Algunas decisiones sencillas mejoran mucho la fiabilidad:

- Inyectar reloj y generador aleatorio en lugar de leer valores globales.
- Esperar eventos o condiciones, no una cantidad arbitraria de milisegundos.
- Crear y limpiar los datos necesarios dentro de cada test.
- Hacer explícitas las dependencias entre procesos y evitar recursos compartidos cuando sea posible.
- Probar el comportamiento observable, no detalles internos sensibles al orden de ejecución.
- Ejecutar periódicamente la suite en condiciones parecidas a las de CI, incluido el paralelismo real.

También conviene recordar que no toda verificación pertenece al mismo nivel. Un test end-to-end puede aportar mucho valor y, al mismo tiempo, tener más fuentes de ruido que una prueba unitaria. La respuesta no es llenar el sistema de esperas, sino reservar esos recorridos para los riesgos que realmente necesitan cubrir y apoyarse en pruebas más pequeñas para el resto.

## La confianza es el verdadero resultado de una suite

No tener tests obliga a asumir un riesgo evidente: cada cambio depende más de revisión manual, memoria y suerte. Es una situación mejorable, pero al menos el equipo sabe dónde está el vacío.

Una suite intermitente añade otra capa de riesgo: ya no se sabe si el mecanismo destinado a detectar errores está funcionando. Esa ambigüedad contamina revisiones, despliegues y prioridades.

Por eso la estabilidad no es un lujo ni una tarea de limpieza para cuando sobre tiempo. Es parte de la corrección de la suite. Un test útil debe comportarse como un buen instrumento de medida: producir resultados comparables y obligar a investigar cuando cambia su lectura.

Ante un test que falla a veces, la pregunta correcta no es «¿cómo conseguimos que vuelva a ponerse verde?». Es «¿qué información nos dará la próxima vez que falle?». Si la respuesta sigue siendo «ninguna», ese test no está protegiendo el software. Está cobrando un peaje por aparentar que lo hace.
