# Los tests que fallan a veces son peores que no tener tests

## La ilusión de seguridad

Tienes un test suite. Las pipelines de CI se ponen en verde. Haces un refactor grande y los tests pasan. Te sientes seguro. Pero la confianza es falsa: el test que a veces falla y a veces pasa es el peor enemigo de la calidad.

Cuando un test es determinista —falla siempre en el mismo input— es una alarma útil. Cuando es no determinista, el equipo aprende a ignorarlo. Y un test ignorado es peor que la ausencia de test, porque drena la atención y enmascara problemas reales.

## El costo cognitivo de la flakiness

- **Falsos positivos**: un test flaky hace fallar pipelines que no deberían fallar. El equipo pierde tiempo re-ejecutando.
- **Pérdida de señal**: cuando el 80% de los tests que fallan son flaky, dejar de mirar los fallos se convierte en hábito. Los bugs reales se entierran bajo el ruido.
- **Des moralización**: los developers dejan de confiar en CI. "Es solo un flaky", "re-run y listo".
- **Fuga de recursos**: cada re-ejecución cuesta minutos y bloquea releases.

## Por qué la flakiness es difícil de erradicar

No es un bug único. Es la suma de:

- Dependencias de timing (sleeps, timeouts, race conditions)
- Estado compartido entre tests (orden, datos, archivos)
- Tests que dependen de la red o de servicios externos sin mocks
- Aserciones sobre cosas no deterministas (randomness, fechas)
- Condiciones de carrera en código de producción que los tests no aislaron
- Tests que dependen del orden de ejecución (test interdependence)

## Cuándo un test flaky es peor que no test

No tener test = ausencia de información. Tienes que razonar sobre el código, pero al menos no te mientes.

Test flaky = información falsa. Te miente cada día, y te acostumbras a la mentira. Cuando finalmente viene un bug real, ya no miras el dashboard rojo.

Regla práctica: un test que falla en CI sin que nadie pueda reproducir el fallo en local en 5 minutos debería ser eliminado o arreglado en 24h. De lo contrario, es peor que nada.

## Modelo mental: test como observador

Piensa el test como un sensor. Un sensor que mide bien o falla claro es útil. Un sensor que mide ruido es peor que no tenerlo: te da datos que parece que significan algo pero no.

La propiedad buscada no es "mucho coverage" sino "signal-to-noise ratio alto". Un suite de 50 tests deterministas beats 500 tests flaky.

## Estrategias prácticas

1. **Cuarentena**: clasifica los tests flaky en un directorio `flaky/` y no los ejecutes en el pipeline principal. Solo los reintentas en un job separado.
2. **Réplicas**: si un test flaky pasa reintentando N veces, eso no es éxito, es thrashing. Trátalo como failing.
3. **Detección temprana**: ejecuta cada nuevo test 50 veces en CI en PR. Si varía, es flaky antes de merge.
4. **Eliminación de sleeps**: todo `sleep` en test es olor. Reemplaza por wait-for-condition con timeout determinista.
5. **Aislamiento**: cada test crea y destruye su propio estado. Nada global.
6. **Seeds fijas**: para cualquier uso de randomness, fija la seed y reporta la seed en el fallo.
7. **Mock de tiempo**: usa reloj falso (`freezegun`, `jest.useFakeTimers`, `clock`).

## Cierre

Los tests son activos de confianza. Un test flaky es deuda técnica con intereses compuestos: cada día el equipo se acostumbra más a ignorar señales rojas. Mejor un suite pequeño, verde, determinista que 500 tests que "a veces fallan" y que nadie ya mira.

Si tienes tests flaky hoy, no los añadas más. Pausa las features nuevas un sprint y límpialos. La deuda de confianza se paga con tiempo de equipo; el test flaky es el impago.

## Checklist antes de mergear un test

- [ ] Determinista: mismo input → mismo resultado, 100 ejecuciones.
- [ ] Sin sleeps.
- [ ] Sin estado compartido.
- [ ] Sin dependencias externas (red, FS real, reloj) no controladas.
- [ ] Sin dependencias de orden entre tests.
- [ ] Falla rápido cuando algo va mal (no timeouts largos).
- [ ] El mensaje de fallo permite diagnosticar sin re-ejecutar.
