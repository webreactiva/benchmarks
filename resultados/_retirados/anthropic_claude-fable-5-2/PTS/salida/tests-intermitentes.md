# Un test que falla a veces es peor que no tener test

Todos los equipos tienen uno. Falla en CI, alguien pulsa "reintentar", pasa, y se hace el merge. Nadie lo investiga porque "ese test es así".

Ese test, el *flaky* o intermitente, parece un problema menor: una molestia de treinta segundos. Mi tesis es que hace más daño que la ausencia de tests, y que conviene tratarlo como un bug de prioridad alta.

## Un test es una señal, y esta señal miente

Un test sirve para una sola cosa: darte información. Verde significa "esto funciona", rojo significa "has roto algo". Todo su valor está en que puedas creerte el color.

Si no tienes tests, no tienes información, y lo sabes. Pruebas a mano, revisas con más cuidado, despliegas con cautela. La incertidumbre es visible y te comportas en consecuencia.

Con un test intermitente tienes algo peor que la falta de información: tienes ruido con aspecto de información. Un rojo ya no significa "has roto algo", significa "has roto algo, o no". Y como la segunda opción es la habitual, aprendes a asumirla siempre.

## El daño real: enseña a ignorar el rojo

El coste importante es el hábito que crea, mucho más que los minutos perdidos en reintentos.

La primera vez que un test falla sin motivo, lo investigas. La quinta, reintentas sin mirar. A partir de ahí, el equipo ha aprendido que un fallo en CI se arregla volviendo a ejecutar el pipeline, y ese aprendizaje se extiende más allá del test culpable. Cuando falla otro test, uno que sí está detectando una regresión, la reacción es la misma: reintentar.

Es la fatiga de alarmas de toda la vida. Una alarma que suena sin motivo consigue que nadie se levante cuando suena con motivo.

Y aquí está el caso más dañino: el bug real que también es intermitente. Una condición de carrera en producción se manifiesta exactamente igual que un test inestable, fallando una de cada veinte veces. Si el equipo tiene la costumbre de reintentar hasta ver verde, ese bug pasará el CI con un par de clics y llegará a los usuarios con el sello de "todos los tests pasan".

## Las cuentas no salen

La probabilidad engaña porque se multiplica. Supón que tienes 200 tests y que cada uno falla sin motivo una de cada mil ejecuciones. Suena excelente: 99,9 % de fiabilidad por test.

La probabilidad de que la suite completa pase limpia es 0,999 elevado a 200, más o menos un 82 %. Casi uno de cada cinco pipelines falla sin que nadie haya roto nada. Con 1000 tests de esa calidad, falla el 63 %.

Por eso "solo falla de vez en cuando" no es un argumento. Unos pocos tests ligeramente inestables bastan para que el rojo sea el estado normal de la rama principal.

## Un ejemplo típico

```python
def test_el_token_caduca():
    token = crear_token(duracion_segundos=1)
    time.sleep(1)
    assert token.ha_caducado()
```

En tu portátil pasa casi siempre. En un runner de CI cargado, depende de cómo se redondee el reloj y de cuánto tarde cada línea. El test depende de algo que no controla: el tiempo real.

La versión determinista inyecta el reloj:

```python
def test_el_token_caduca():
    reloj = RelojFalso(ahora=1000)
    token = crear_token(duracion_segundos=60, reloj=reloj)
    reloj.avanzar(61)
    assert token.ha_caducado()
```

Ya no hay `sleep`, el test tarda microsegundos y da el mismo resultado en cualquier máquina.

Casi todos los tests intermitentes tienen la misma raíz: dependen de algo que el test no controla. Las causas habituales son pocas:

- **Tiempo:** `sleep`, timeouts ajustados, fechas reales (el test que falla a medianoche o el día del cambio de hora).
- **Orden:** tests que comparten estado y solo pasan si se ejecutan en cierta secuencia.
- **Concurrencia:** esperar "un rato" a que termine algo asíncrono en lugar de esperar a una condición.
- **Exterior:** red, servicios de terceros, una base de datos compartida con otros pipelines.
- **Azar:** datos aleatorios sin semilla fija, u orden de iteración no garantizado.

## Qué hacer

**Poner el test en cuarentena de inmediato.** Sácalo de la suite que bloquea los merges el mismo día que se detecta. Puede parecer que pierdes cobertura, pero un test que todo el mundo ignora ya no cubre nada, y mientras siga ahí está degradando la credibilidad de los demás.

**Darle un dueño y una fecha.** La cuarentena sin plazo es un cementerio. Abre una incidencia, asígnala y fija un límite: si en dos semanas nadie lo ha arreglado, se borra.

**Arreglarlo o borrarlo.** No hay tercera opción estable. Si el comportamiento que verifica importa, merece un test determinista. Si nadie considera que valga el esfuerzo, el test no aportaba lo suficiente.

**Desconfiar del reintento automático.** Configurar el CI para repetir los fallos tres veces esconde el síntoma y también las condiciones de carrera reales. Si lo usas, que cada reintento quede registrado y se revise; un test que necesita reintentos es un test en cuarentena que aún no has movido.

**Medir.** Guarda el historial de resultados por test. Un test que ha pasado y fallado sobre el mismo commit es intermitente por definición, y eso se puede detectar automáticamente sin esperar a que alguien se queje.

## La regla

Una suite pequeña en la que cada rojo significa algo vale más que una suite enorme en la que el rojo es una sugerencia. El objetivo es que, cuando el pipeline falle, la primera reacción del equipo sea "¿qué hemos roto?" y no "dale otra vez".

Si tu equipo ya tiene el reflejo de reintentar, empieza por ahí: busca el test que más veces se ha reejecutado este mes y ponlo en cuarentena hoy.
