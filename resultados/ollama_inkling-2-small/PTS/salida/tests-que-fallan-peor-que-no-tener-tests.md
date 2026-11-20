# Por qué los tests que fallan a veces son peores que no tener tests

Todos hemos escuchado el mantra: *sin tests no hay confianza*. Y es cierto... hasta cierto punto. Hay un estado peor que no tener tests, y es tener una suite de tests que falla constantemente, falla sin motivo, o falla por razones que nadie entiende. En ese escenario, los tests no solo dejan de protegerte: se convierten en un impuesto activo sobre cada cambio que haces.

Este post es sobre ese estado: el desgaste que produce una suite en la que nadie confía, y qué hacer al respecto.

## El test que falla y nadie atiende

Imagina este flujo, que seguro te resulta familiar:

1. Abres un PR. El CI está rojo.
2. Miras el log: falló `test_export_csv_with_unicode`.
3. No tocaste nada de exportación. Reintentas el job.
4. El CI pasa. Mergeas.
5. Tres semanas después, ese mismo test falla por un bug real... y nadie lo nota, porque "siempre falla".

Ese último paso es el coste real. Un test que se ignora no es un test: es ruido con formato de test. Y el ruido tiene un efecto corrosivo: entrena al equipo para ignorar las señales rojas. Cada falso positivo erosiona la confianza en los verdaderos positivos.

## Qué malo es exactamente, y cuándo

Conviene distinguir casos, porque "tests que fallan" abarca situaciones muy distintas:

### 1. Tests flaky (intermitentes)

Fallan y pasan sin cambios en el código. Causas típicas: orden de ejecución, dependencia de tiempo o fecha, red, concurrencia, estado compartido entre tests. Son los más peligrosos porque su fallo *parece* informacional pero no lo es.

### 2. Tests rojos congelados

Alguien rompió algo, el test falló, y en lugar de arreglarlo se marcó como `skip` o se dejó fallar con un `@Ignore` y un ticket que nunca se completó. La suite queda en un limbo donde "rojo es lo normal".

### 3. Tests desincronizados con la realidad

El comportamiento cambió legítimamente pero el test no se actualizó. Falla siempre, y falla *con razón*, pero nadie recuerda qué significa. Es el caso más parecido a no tener test: la información que aporta es cero.

### 4. El contraste: test rojo legítimo

Un test que falla porque encontraste un bug real **es** valioso. El problema nunca es el rojo; el problema es el rojo que no informa de nada o en el que ya no confías.

## Por qué son peores que no tener nada

- **Fatiga de alertas.** Si el 30 % de los fallos son falsos positivos, el equipo aprende a no reaccionar. Cuando el fallo real llegue, se pierde en el ruido.
- **Coste cognitivo constante.** Cada PR paga un impuesto de investigación: ¿este fallo es mío o es el de siempre? Ese coste se multiplica por cada desarrollador y cada PR.
- **Falsa sensación de seguridad.** La gente asume que "hay tests", así que refactoriza con confianza... pero la suite no protege nada si nadie la ejecuta con actitud de fallo serio.
- **Erosionan la cultura de calidad.** Si el CI es negociable, la calidad pasa a ser negociable. Los estándares se definen por lo que toleras, no por lo que declaras.
- **Contaminan la señal del CI.** El rojo deja de significar "no mergear", y el CI se convierte en un trámite más que se reintenta hasta que se pone verde.

No tener tests, al menos, te fuerza a ser consciente de tu fragilidad. Una suite rota te convence de que estás protegido cuando no lo estás.

## Cómo salir del agujero

No se arregla con fuerza de voluntad. Se arregla con sistema.

### 1. Pon un presupuesto de flakiness

Mide la tasa de fallos intermitentes y ponle un límite explícito (por ejemplo, "cero tests flaky en main; si aparece uno, es prioridad sobre features"). Lo que no se mide no se gestiona.

### 2. Cuarentena, no silencio

Si un test es flaky y no puedes arreglarlo hoy, sácalo de la suite principal a una cuarentena visible y con dueño, con un plazo. Un `@skip` sin ticket y sin fecha es un agujero negro de deuda técnica.

### 3. Reintentar está prohibido (salvo como diagnóstico)

Hacer `retry` hasta que el CI pase es papel, no ingeniería. Si usas reintentos, que sea para *detectar* flakiness ("este test solo pasa a la segunda: es flaky"), no para silenciarla.

### 4. Caza la causa raíz, en este orden

1. Estado compartido y orden de ejecución (ejecuta la suite en orden aleatorio).
2. Tiempo y fechas (inyecta el reloj).
3. Red y servicios externos (mocks o entornos efímeros).
4. Concurrencia y carreras.

### 5. Si un test no aporta señal, bórralo

Un test que falla siempre y cuyo valor nadie puede explicar no es un activo; es un pasivo. Bórralo o reescríbelo. Menos tests, más confianza.

### 6. Protege el significado del rojo

La regla de oro: **un CI rojo bloquea el merge, siempre, o no significa nada**. Si el equipo puede mergear con rojo y "ya se arreglará", el CI es decoración.

## Señales de que tu suite está rota

- La gente hace *re-run* antes de leer el nombre del test que falló.
- Existen tests con `@Ignore`/`skip` de hace más de un trimestre.
- Nadie sabe decir cuántos fallos en el CI son falsos positivos esta semana.
- El merge con CI rojo ocurre "a veces".
- Palabras como "ah, ese test siempre falla" aparecen en code reviews.

Si reconociste tres o más, no tienes una suite de tests: tienes un generador de ruido caro.

## Reflexión final

Un test es una promesa: "si esto se rompe, alguien se enterará". Cuando el equipo deja de creerse la promesa, el test deja de existir como tal, por mucho que siga ejecutándose en CI. La confianza es el verdadero producto de una suite de tests, y se construye con pocas cosas —pero importantes—: que los fallos sean reales, que el rojo bloquee de verdad, y que los tests flaky sean una emergencia, no un hábito.

No tener tests es admitir que caminas sin red. Tener tests que nadie cree es saltar con una red que no sabes si está atada. Entre las dos, la primera al menos te mantiene alerta.

---

*¿Tu equipo tiene tests flaky que nadie toca? Empieza por el inventario: lista todos los `skip` del repo, mídeles antigüedad y asigna dueño. Es el ejercicio de mayor impacto por hora invertida que conozco.*
