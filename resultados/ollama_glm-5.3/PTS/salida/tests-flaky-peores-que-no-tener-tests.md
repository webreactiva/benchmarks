# Los tests que fallan a veces son peores que no tener tests

Hay una frase que aparece una y otra vez en equipos de desarrollo: *"ya sabes que ese test es así, dale otra vez al pipeline y pasa"*. Si la has dicho (o la has oído) recientemente, este artículo es para ti.

Un test *flaky* (o "que falla a veces") es ese test que pasa el lunes, falla el martes, vuelve a pasar si lo ejecutas solo, y falla aleatoriamente cuando se ejecuta junto con el resto de la suite. Parece un problema menor: al fin y al cabo, el 90% de las veces está en verde. Pero ese razonamiento es una trampa. En este artículo quiero defender una idea incómoda: **un test no determinista es, en la práctica, peor que no tener test alguno**.

## 1. El valor de un test está en su confianza, no en su cobertura

¿Para qué escribimos tests? La respuesta obvia es "para verificar que el código funciona", pero la respuesta real es más sutil: **los tests existen para darnos confianza a la hora de cambiar el código**. Esa confianza es lo único que nos permite refactorizar sin miedo, entregar rápido y dormir tranquilos.

Un test flaky destruye exactamente eso. Cuando un test falla, el mensaje que recibe el equipo es: "algo está roto... o quizá no". Y ante la incertidumbre, el cerebro humano hace lo peor posible: **aprender a ignorar las alarmas**.

No tener tests, en cambio, produce un estado mental sano: "no tengo red de seguridad, tengo que ir con cuidado". Es incómodo, pero al menos es honesto. Con tests flaky creemos tener una red de seguridad que en realidad tiene agujeros que aparecen al azar. La falsa sensación de seguridad es más peligrosa que la ausencia de seguridad, porque la primera no te invita a mirar abajo.

## 2. El semáforo que siempre está en rojo termina siendo ignorado

Es el principio del guardia de seguridad del pueblo que grita "¡lobo!" cada media hora. En un equipo con flakiness, el flujo de trabajo se corrompe:

1. Falla el CI.
2. Alguien mira el log, ve que es "el de siempre".
3. Pensa: *"probablemente es el flaky"*, y pulsa *retry*.
4. Pasa al segundo intento. Nadie revisó nada.

El paso 4 es el letal. Fíjate en lo que ha ocurrido: **el pipeline ha dejado de ser una señal y se ha convertido en una ruleta**. Y cada vez que falla algo *real*, el instinto es el mismo: "seguro que es el flaky". El resultado es que los bugs de verdad pueden colarse en producción porque el único mecanismo que teníamos para detectarlos se ha vuelto ruido de fondo.

Un equipo sin tests nunca desarrollaría ese reflejo. Nadie puede ignorar una alarma que no suena.

## 3. El coste económico que nadie contabiliza

La flakiness es cara de una forma que casi ningún equipo calcula:

- **Tiempo de re-ejecución.** Si tu suite tarda 20 minutos y el retry es el procedimiento estándar, has multiplicado tu feedback loop por dos o por tres. Eso no es solo tiempo de máquina: es tiempo de *persona* esperando.
- **Tiempo de investigación.** Cada falso positivo consume minutos (u horas) de alguien abriendo logs, re-ejecutando localmente, preguntando en el canal del equipo.
- **Coste de cómputo.** Pipelines repetidos, runners ocupados, colas de CI más largas para todo el mundo.
- **Paralización del flujo.** Los PR se acumulan esperando un verde que depende de la suerte. Mientras tanto, el merge se retrasa, aumenta el riesgo de conflictos y el coste de cada integración crece.

Y hay un efecto segundo aún más caro: **la gente deja de confiar y deja de arreglar**. Los tests flaky se marcan con `skip` o `flake8-ignore-comments` y pasan a formar parte del mobiliario. Nadie los toca. Ya no protegen nada, pero siguen consumiendo presupuesto.

## 4. La cobertura engañosa

Otro argumento en contra: un test flaky contamina tus métricas. Ese módulo puede presumir de un 90% de cobertura y sin embargo no estar verificado de verdad, porque la única aserción que tiene es intermitente.

La cobertura es un proxy de calidad, y los proxies son útiles solo cuando miden lo que dicen medir. Un dashboard que dice "85% cubierto" cuando el 15% restante incluye tests deshabilitados o intermitentes es una mentira con formato de gráfico. Prefiero un 60% honesto que un 90% adornado con asteriscos mentales.

## 5. ¿De dónde viene la flakiness?

Normalmente no es mala suerte: es un síntoma de que algo más está mal. Las causas más frecuentes:

- **Dependencia del tiempo.** `sleep(5)` en lugar de sincronizarse con una condición. El tiempo de espera suficiente en tu portátil no lo es en el runner del CI.
- **Estado compartido entre tests.** Tests que dependen del orden de ejecución, de datos residuales en base de datos o de singletons que no se resetean.
- **Concurrencia sin controlar.** Threads, colas, temporizadores: el clásico "espero que ya haya terminado".
- **Dependencia del entorno.** Fechas actuales (`new Date()`), zonas horarias, locales, directorios temporales, dependencias de red.
- **Tests de UI acoplados al detalle.** Selectores frágiles, animaciones, elementos que aparecen y desaparecen.

El caso del `sleep` es un clásico tan común que merece su propio ejemplo. Mal:

```javascript
// Incorrecto: una espera fija no garantiza nada
await page.click("#send");
await sleep(2000); // "por si acaso"
expect(await page.textContent("#status")).toBe("Sent");
```

Bien:

```javascript
// Correcto: esperamos una condición observable
await page.click("#send");
await page.waitForSelector("#status:has-text('Sent')");
```

La diferencia no es de estilo: la primera versión falla cuando el entorno va lento y esconde bugs cuando va rápido. La segunda es determinista *por diseño*.

## 6. Qué hacer con un flaky (spoiler: no es "retry")

Algunas estrategias que sí funcionan, en orden de preferencia:

1. **Trátalo como un bug crítico, no como una molestia.** Un test intermitente es un bug con dos caras: o el código es no determinista (y eso es un bug de producción esperando a ocurrir), o el test es incorrecto. Ambas opciones merecen atención inmediata.
2. **Arregla o borra. No hay tercera opción.** El principio es simple: cualquier test que no puedas hacer determinista, no debería existir. Borrar un flaky no es perder cobertura; es dejar de mentir en el dashboard. Recuperarlo cuando tengas la causa raíz identificada.
3. **Reproduce con semillas y repeticiones.** Ejecuta el test sospechoso en bucle (`for i in {1..100}`) y con seeds de aleatoriedad fijas y registradas. La flakiness que se puede reproducir a demanda se puede depurar.
4. **Elimina el estado compartido.** Cada test debe crear su propio mundo y desmontarlo al terminar. Bases de datos en contenedor, factories en lugar de fixtures globales, y nada de tests que dependen del orden.
5. **Si necesitas cuarenta, que sea visible y temporal.** Aislar un test flaky en una suite separada puede ser una estrategia de emergencia legítima, pero solo si (a) es visible para todo el equipo, (b) tiene un issue asociado y (c) caduca. Una cuarenta sin fecha de caducidad es un cementerio.

Y la regla de oro que resume todo:

> **Un CI que falla debe significar siempre que algo está roto. Nunca "a veces".**

## Conclusión

Los tests no son un trámite para rellenar el panel de cobertura: son un sistema de alarma. Un sistema de alarma que suena de forma aleatoria se desinstala, se ignora o se silencia; en cualquier caso, deja de proteger.

La flakiness no es una peculiaridad inevitable del testing moderno: es deuda técnica con un disfraz especialmente traidor, porque se presenta con la palabra "test" delante. Si tu equipo ha normalizado el botón de retry, considera seriamente que tenéis dos problemas: el test que falla a veces, y la costumbre de mirar hacia otro lado.

Arreglad los flaky o borradlos. Vuestro futuro vosotros, con el pipeline en verde de verdad, os lo agradecerá.
