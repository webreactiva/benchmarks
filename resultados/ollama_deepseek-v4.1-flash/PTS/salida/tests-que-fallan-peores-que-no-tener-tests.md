# Cuando el rojo se vuelve invisible: por qué un test que falla puede ser peor que no tener tests

Hay una frase que se repite en casi todas las charlas de buenas prácticas: *"mejor tener tests que no tenerlos"*. Y es una buena regla general. Pero como toda regla, tiene excepciones que conviene mirar de cerca. Porque un test que falla de forma crónica, que nadie atiende o que miente, no solo deja de aportar: puede ser **más dañino que la ausencia total de tests**.

No hablo del test que falla una vez y te señala un bug real. Hablo del que se queda en rojo durante semanas, del que falla de manera intermitente, del que todos aprendieron a ignorar. Ese test no es una red de seguridad. Es una alarma de incendios que suena todo el día.

## El problema no es el fallo, es la costumbre

Un test que falla y se arregla es información valiosa. Un test que falla y nadie arregla se convierte en **ruido de fondo**. Y el ruido de fondo tiene un efecto conocido en psicología: la habituación. Dejamos de escucharlo.

Cuando el pipeline lleva tres semanas en rojo, aparece una frase peligrosa en la cultura del equipo:

> "Ese test siempre falla, ignóralo."

En ese momento el test ya no cumple ninguna función. Peor aún, empieza a cumplir una función negativa: **normaliza el fallo**. El equipo se acostumbra a que "algo esté mal" y deja de investigar. Y cuando un test *nuevo* señale un bug real, se perderá entre los otros veinte que llevan meses en rojo.

Un proyecto sin tests, al menos, no te engaña: sabes que estás caminando sin red. Un proyecto con un tablero permanentemente en rojo te hace creer que tienes red, cuando en realidad tienes un colador.

## La fatiga de alarmas y el costo de la duda

Los sistemas de monitoreo lo tienen estudiado: si una alerta se dispara con demasiada frecuencia y sin consecuencias reales, los operadores empiezan a ignorarla. Los tests automatizados no son distintos.

Piénsalo en términos de tiempo. Cada vez que el CI se pone en rojo, alguien tiene que:

1. Detenerse a mirar qué falló.
2. Decidir si es un bug real, un test frágil o un problema de infraestructura.
3. Comunicarlo al equipo o ignorarlo conscientemente.

Si esto pasa varias veces al día, el costo se acumula. Y no es solo el tiempo: es la **carga cognitiva** de tener que decidir, una y otra vez, si el rojo importa. Esa duda permanente es agotadora, y en algún punto el equipo opta por la decisión más barata: dejar de mirar.

Aquí está la trampa: el test que falla constantemente **destruye la señal** de los tests que sí funcionan. Un conjunto de 500 tests donde 30 fallan siempre es, en la práctica, un conjunto de 470 tests, pero con un 100% de desconfianza.

## Tests frágiles: cuando el test miente

Están los que fallan por razones equivocadas. Dependen del reloj del sistema, del orden de ejecución, de una base de datos compartida, de una llamada de red, de una zona horaria o de un `sleep` de dos segundos que "casi siempre alcanza".

Estos tests son especialmente perversos porque fallan de forma intermitente. Pasan en tu máquina, fallan en el CI. Pasan en el CI, fallan en tu máquina. Le rezas al dios de los reintentos y vuelves a lanzar el pipeline.

El resultado es doble:

- **Te hacen perder tiempo** persiguiendo fantasmas.
- **Te enseñan a desconfiar de los fallos**, que es exactamente lo contrario de lo que quieres.

Un test frágil es peor que no tener test porque, además de no protegerte, te entrena para ignorar las señales. Y cuando llegue el fallo verdadero, ya habrás aprendido que los rojos no significan nada.

## La falsa confianza de los tests desactivados

Ante un test que molesta, hay tres salidas: arreglarlo, borrarlo o esconderlo. La tercera es la más común y la más peligrosa.

```python
@pytest.mark.skip(reason="flaky, lo vemos después")
def test_conciliacion_de_pagos():
    ...
```

Ese `skip` deja una marca en el código que dice "esto está cubierto", pero no cubre nada. En el reporte de cobertura el archivo aparece en verde. En las discusiones de equipo alguien dice "sí, tenemos tests para esa parte". Y sin embargo, el comportamiento crítico ya no está verificado por nadie.

La cobertura es una de las métricas más fáciles de engañar. Un test saltado, un test que solo verifica que "no explota", un test que asume exactamente la implementación actual: todos suman cobertura y restan protección. Los tests malos **producen una sensación de seguridad que no corresponde a la realidad**, y esa falsa confianza es más peligrosa que la ignorancia honesta.

## Tests que verifican lo incorrecto

Hay un caso todavía más sutil: el test que pasa, pero que asegura un comportamiento equivocado.

Supongamos que un test captura la salida de una función y la compara con un resultado que en realidad contiene un bug. Mientras el bug siga ahí, el test está en verde. El día que alguien lo corrija, el test se pondrá rojo y podría frenar la corrección. El test se convirtió en un **guardián del error**.

Los tests son código, y el código puede estar mal. Un test que no se revisa con el mismo rigor que la implementación no es una fuente de verdad: es una segunda opinión igual de falible, pero con autoridad de juez.

## El costo real: el pipeline como cuello de botella

En equipos que practican integración continua, un pipeline en rojo bloquea despliegues. Eso es correcto cuando el fallo importa. Pero si el fallo es crónico y "conocido", el equipo empieza a buscar atajos:

- Se ignoran los tests con `--force` o flags de "saltar los que fallan".
- Se configuran reglas de "permitir fallos" (allowed failures) para ciertos jobs.
- Se aprueban pull requests con el CI en rojo y una nota de "los fallos son los de siempre".

Cada uno de estos atajos es razonable en el momento y desastroso en conjunto. Poco a poco, el sistema de calidad se convierte en teatro: hay tests, hay CI, hay reportes, pero **nadie confía en ellos y todos aprenden a rodearlos**. Has construido la infraestructura de la seguridad sin la seguridad.

## Un test que falla no siempre es un mal test

Conviene hacer una distinción importante, porque no quiero que esto se lea como "borren sus tests".

Un test que falla puede ser:

- **Valioso**: señala un bug real, un cambio de contrato, una regresión. Hay que atenderlo.
- **Ruidoso**: es frágil o dependiente del entorno. Hay que arreglarlo o eliminarlo.
- **Muerto**: está ignorado, saltado o desactualizado. Hay que decidir: revivirlo o enterrarlo.

El problema nunca es que un test falle. El problema es **la falla que se vuelve estado permanente**. Un test rojo que se ignora deja de ser una herramienta y se convierte en decoración. Y la decoración que parece seguridad es lo peor que le puede pasar a un equipo.

## La regla que sí vale la pena adoptar

Si tuviera que resumirlo en una política, sería esta:

> Un test que falla es una deuda con vencimiento inmediato. O se arregla, o se borra. Lo que no se hace es dejarlo en rojo.

Esto obliga a tomar decisiones honestas:

- **Si el test falla por un bug**: arréglalo. Ese es el trabajo.
- **Si el test es frágil**: hazlo determinista o elimínalo. Un test frágil no vale el tiempo que consume.
- **Si el test ya no representa un requisito**: bórralo sin culpa. Los requisitos cambian.
- **Si necesitas desactivarlo temporalmente**: ponle fecha de caducidad y un ticket. Un `skip` sin dueño es un `skip` para siempre.

Y una recomendación cultural: **trata el pipeline en rojo como una emergencia**, no como el clima. Si el rojo es normal, la calidad se vuelve opcional.

## Conclusión

Tener tests es mejor que no tenerlos, pero solo cuando esos tests son confiables. Un conjunto de pruebas que falla constantemente, que miente o que nadie mira no es una red de seguridad: es una ilusión costosa. Consume tiempo, erosiona la confianza y, sobre todo, **entrena al equipo para ignorar las señales de peligro**.

No tener tests te deja vulnerable, pero al menos te deja honesto. Un test que falla y se ignora te deja vulnerable *y* convencido de que estás protegido. Y esa combinación es, casi siempre, peor.

La próxima vez que veas un rojo que lleva días ahí, no lo mires como "el test que siempre falla". Míralo como una decisión pendiente que el equipo lleva demasiado tiempo evitando. Arréglalo o bórralo, pero no lo dejes ahí fingiendo que hace su trabajo.
