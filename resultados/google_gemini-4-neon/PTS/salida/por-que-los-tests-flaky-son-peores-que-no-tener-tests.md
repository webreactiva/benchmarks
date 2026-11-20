# Por qué los tests que fallan a veces son peores que no tener tests

Todos conocemos esa escena.

Abres un *pull request* con un cambio trivial —has corregido una errata en un mensaje de error o ajustado un margen en CSS—, esperas diez minutos a que termine el CI y aparece la temida cruz roja. Entras a ver el log. Ha fallado un test de integración del módulo de facturación que no has tocado en tu vida.

Le preguntas a un compañero por Slack. Su respuesta llega en cinco segundos:

> *"Ah, sí, ese falla a veces. Dale a **Re-run** y pasa."*

Le das al botón. Diez minutos después está todo en verde. Haces *merge* y sigues con tu día.

Parece una molestia menor, un pequeño peaje del desarrollo de software moderno. Pero no lo es. Ese momento inocente es el síntoma de uno de los problemas más corrosivos que puede sufrir un equipo de ingeniería: los **tests intermitentes** (o *flaky tests*).

Y aunque suene contraintuitivo, convivir con ellos es objetivamente peor que no tener esos tests en absoluto.

---

## La diferencia entre no tener red y tener una red rota

Cuando un proyecto no tiene tests, la situación es mala, pero al menos es honesta. Todo el equipo sabe que camina sin red. Revisas los cambios con más cuidado, pruebas manualmente los flujos críticos antes de desplegar y eres consciente del riesgo que asumes.

Un test que falla de forma aleatoria rompe ese contrato. Promete darte una señal binaria —*funciona* o *está roto*— y en su lugar te devuelve ruido. Y en ingeniería, el ruido disfrazado de señal es mucho más peligroso que el silencio.

### 1. El síndrome de «que viene el lobo»

El único valor real de una suite de tests es la **confianza** que depositas en su veredicto. Cuando el CI se pone rojo, tu reacción instintiva debería ser: *"He roto algo, voy a ver qué es"*.

Cuando el equipo se acostumbra a los fallos intermitentes, esa reacción desaparece y es reemplazada por otra: *"Otra vez el CI haciendo el tonto, vamos a relanzarlo"*.

En el momento en que pulsar *Re-run* se vuelve un reflejo automático, tu suite ha dejado de protegerte. Tarde o temprano, un test fallará por un bug real, alguien asumirá que es el fallo de siempre, insistirá hasta que pase (o lo ignorará) y el error llegará a producción.

### 2. Un impuesto invisible sobre el tiempo y la concentración

Un solo test con un 5% de probabilidad de fallo parece inofensivo sobre el papel. Sin embargo, las matemáticas no perdonan: si tienes 20 tests así en tu suite, la probabilidad de que una ejecución completa pase a la primera cae al **36%**. Casi dos de cada tres *builds* fallarán sin motivo.

El coste no son solo los minutos extra de CI:

- **Cambios de contexto constantes:** dejas lo que estás haciendo para investigar un error que no existe.
- **Cuellos de botella en los despliegues:** *hotfixes* urgentes bloqueados esperando a que la ruleta del CI salga verde.
- **Fricción innecesaria en las revisiones:** los *pull requests* se quedan atascados durante horas por causas ajenas al código revisado.

### 3. La erosión de la cultura de testing

Los tests inestables son contagiosos a nivel cultural. Cuando un desarrollador nuevo llega al equipo y ve que la mitad de los fallos del CI se ignoran, aprende rápido una lección tóxica: *los tests aquí son un trámite burocrático, no una herramienta útil*.

A partir de ahí, todo va cuesta abajo:

- La gente deja de escribir tests completos porque «solo dan problemas».
- Los tests existentes dejan de mantenerse.
- Cuando un fallo es legítimo pero difícil de depurar, aumenta la tentación de marcarlo como `skip` o «arreglarlo» añadiendo un `sleep(2000)` que empeora el problema.

### 4. Esconden bugs reales de producción

Este es el daño menos obvio y, a veces, el más caro. No todos los tests *flaky* son tests mal escritos. A menudo, un test que falla una de cada veinte veces está destapando una **condición de carrera**, un problema de concurrencia o un fallo de ordenación real en tu código de producción.

Si tu reflejo es darle a *Re-run* hasta que se ponga verde, no solo estás ignorando el test: estás silenciando la única alarma que te avisaba de un bug que tus usuarios van a sufrir de forma aleatoria en producción.

---

## De dónde salen casi siempre los tests inestables

Aunque cada proyecto tiene sus particularidades, la gran mayoría de los tests intermitentes se explican por un puñado de causas muy concretas:

1. **Dependencia del tiempo real:** usar `sleep` o `setTimeout` esperando que una operación asíncrona «ya habrá terminado para entonces». En tu portátil tarda 50 ms; en un *runner* saturado del CI tarda 400 ms y el test explota. Lo mismo ocurre con fechas sin congelar (`Date.now()`, cambios de día a medianoche o zonas horarias).
2. **Estado compartido entre tests:** un test deja registros en la base de datos, muta una variable global o ensucia una caché, y el siguiente test solo pasa si se ejecuta en un orden concreto.
3. **Asincronía mal sincronizada:** comprobar el resultado de una interfaz o de una cola de mensajes antes de que el evento haya terminado de procesarse, en lugar de esperar explícitamente a la condición esperada.
4. **Dependencias externas reales:** llamadas a servicios de terceros, red inestable o ficheros compartidos fuera del control del test.
5. **Aleatoriedad sin semilla fija:** generar datos aleatorios (como *fakers* de usuarios o importes) que ocasionalmente producen un caso límite no contemplado por las aserciones.

Un ejemplo clásico en JavaScript:

```js
// Frágil: depende de la velocidad de la máquina
test("muestra la notificación tras guardar", async () => {
  clickSaveButton();
  await sleep(300);
  expect(screen.queryByText("Guardado")).toBeInTheDocument();
});

// Determinista: espera explícitamente a la condición con un timeout razonable
test("muestra la notificación tras guardar", async () => {
  clickSaveButton();
  expect(await screen.findByText("Guardado")).toBeInTheDocument();
});
```

La diferencia parece mínima, pero una versión apuesta contra la carga de la CPU y la otra espera a que ocurra lo que de verdad importa.

---

## Qué hacer en lugar de convivir con ellos

Aceptar los tests intermitentes como «algo normal» es una decisión, no una fatalidad. Si quieres recuperar la confianza en tu suite, hacen falta medidas firmes:

### Trata un test *flaky* como un bug prioritario (o bórralo)

Si un test falla sin que haya cambiado el código, solo hay dos salidas aceptables a corto plazo: **arreglarlo hoy** o **sacarlo de la suite principal** (ponerlo en cuarentena o eliminarlo) mientras se investiga.

A mucha gente le cuesta borrar un test porque siente que pierde cobertura. Pero un test que miente no aporta cobertura: aporta ruido y destruye la credibilidad del resto de la suite. Prefiere 100 tests en los que el equipo confíe al 100% antes que 1.000 de los que nadie se fíe.

### Cuidado con los reintentos automáticos (`retries`)

Configurar el *test runner* para reintentar automáticamente los tests fallidos es muy tentador. El CI vuelve a estar verde de la noche a la mañana.

El problema es que los reintentos son un analgésico, no una cura:

- Si no registras y monitorizas qué tests necesitaron reintento, el problema simplemente se vuelve invisible.
- Multiplican el tiempo de ejecución del CI cuando hay fallos reales.
- Tapan condiciones de carrera en el código de producción.

Si usas reintentos en tests *end-to-end* por razones prácticas, asegúrate de que cada reintento dispare una métrica o una alerta para corregir el test cuanto antes.

### Estresa los tests nuevos antes de hacer *merge*

El mejor momento para cazar un test inestable es antes de que entre en la rama principal. Ejecutar los tests nuevos o modificados 10 o 20 veces seguidas en el CI (o en local) suele bastar para sacar a la luz dependencias de tiempo o estado compartido cuando todavía tienes todo el contexto en la cabeza.

### Diseña pensando en el determinismo

- **Inyecta el reloj:** controla las fechas y horas en los tests en lugar de depender del reloj del sistema.
- **Aísla cada test:** cada caso debe crear sus propios datos y limpiar su propio estado, de modo que pueda ejecutarse solo, en paralelo o en cualquier orden.
- **Usa semillas fijas** si generas datos aleatorios, e imprime la semilla en el log si el test falla para poder reproducirlo exactamente.
- **Empuja la lógica hacia abajo:** cuanto más dependas de tests pesados de navegador para verificar reglas de negocio, mayor será la superficie de inestabilidad.

---

## En resumen

Una suite de tests es un sistema de alarma contra incendios. Si no tienes alarma, al menos sabes que tienes que vigilar la cocina. Pero si tienes una alarma que suena cada dos días porque sí, acabarás quitándole las pilas.

La próxima vez que alguien te diga *"dale a re-run y ya pasa"*, no lo normalices. Ese botón no está arreglando tu CI: está entrenando a tu equipo para ignorar sus propias pruebas. Y cuando nadie cree en los tests, ya da igual cuántos tengas.
