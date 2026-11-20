# Por qué los tests que fallan a veces son peores que no tener tests

**Fecha:** 20 de noviembre de 2026
**Categoría:** Buenas prácticas / Calidad de software

Hay una frase que se repite en equipos de desarrollo: «cualquier cobertura de tests es mejor que ninguna». Y durante mucho tiempo yo también la creí. Pero después de ver suites de tests rotas diente tras diente en varios proyectos, llegué a una conclusión incómoda: **un test que falla de forma intermitente puede hacer más daño que no tener ningún test**.

No hablo de los tests que fallan porque el código está roto (ese es su trabajo). Hablo de esos tests que a veces pasan y a veces fallan sin que nadie haya tocado nada, o que fallan por razones que nada tienen que ver con lo que supuestamente verifican. Ese tipo de tests es tóxico, y aquí te explico por qué.

---

## 1. Entrenan al equipo a ignorarlos

Cuando un test falla sin razón aparente, la reacción natural es: «ya lo arreglaré luego». Y luego nunca llega. Al cabo de semanas, el equipo desarrolla lo que se conoce como *fatiga de alarmas*: si la suite está en rojo la mitad del tiempo, nadie presta atención cuando realmente importa.

> Un test que falla falsamente es como una alarma de incendios que suena cada dos por tres. Al final, la gente la desconecta.

Cuando llega el día en que el test falla *de verdad* —porque alguien rompió la lógica de negocio—, ya nadie reacciona a tiempo. El daño ya está en producción.

## 2. Hacen que la gente pierda tiempo investigando fantasmas

Un test flaky (inestable) obliga a quien lo ve fallar a detenerse y comprobar: «¿he roto algo yo?». La respuesta, la mayoría de las veces, es no. Ese tiempo se multiplica por cada desarrollador, cada día, cada integración. En un equipo de diez personas, un puñado de tests inestables puede devorar horas semanales en investigaciones que no llevan a ninguna parte.

Y lo peor: a veces la gente «arregla» el test añadiendo `sleep`, reintentos aleatorios o aserciones más laxas. Pan para hoy, deuda para mañana.

## 3. Erosionan la confianza en toda la suite

Los tests tienen un valor fundamental: la confianza. Cuando un desarrollador puede ejecutar la suite y confiar en que verde significa «esto funciona», los tests se convierten en una red de seguridad real. Pero cada fallo falso desgasta esa confianza.

Con el tiempo, la suite deja de ser una herramienta de verificación para convertirse en ruido de fondo. Y un test que no genera confianza no merece la pena mantenerse: consume tiempo de ejecución, de mantenimiento y de atención cognitiva sin devolver valor.

## 4. Pueden ocultar bugs reales

Este es el argumento más fuerte. Imagina que tienes un test que falla intermitentemente desde hace meses. Cada vez que falla, alguien lo marca como «ya sabemos que falla a veces» y sigue adelante. El día que ese mismo test falla porque has introducido un bug grave en el cálculo de precios, el fallo queda camuflado entre los falsos positivos. **Los tests inestables crean un velo de ruido bajo el cual los bugs reales se esconden.**

## 5. Generan deuda técnica silenciosa

Un test inestable suele ser síntoma de un problema más profundo: dependencias externas no mockeadas, condiciones de carrera, datos de prueba compartidos, relojes reales en lugar de inyección de tiempo, puertos ocupados... Ignorar el test es ignorar la causa raíz. Y las causas raíz no se van solas: empeoran.

## ¿Cuándo SÍ merece la pena un test que falla?

Para ser justos: un test que falla de forma **determinista** y que revela un bug real es oro puro. Ese test hay que arreglarlo (el código o el test), no ignorarlo. La diferencia clave es la **determinidad**:

- Test determinista que falla → probablemente hay un bug real → actúa YA.
- Test que falla solo a veces → casi siempre es un problema del test → arréglalo o elimínalo.

## Qué hacer con los tests inestables

1. **No los ignores.** Si un test es flaky, trátalo como un bug de primera categoría.
2. **Aísla la causa.** Lo más común: dependencias de red, tiempo, orden de ejecución, estado compartido o condiciones de carrera. Usa mocks, inyección de dependencias, fixtures limpias y datos deterministas.
3. **Ejecuta el test muchas veces** (`--count=20` en algunos frameworks) para reproducir la inestabilidad antes de darlo por arreglado.
4. **Si no puedes estabilizarlo, elimínalo o ponlo en cuarentena** con un issue trazable. Un test que no se ejecuta no Gana confianza; al menos es honesto.
5. **Haz que la suite fallida bloquee el merge.** Si permites mergear con tests en rojo, estás entrenando al equipo para ignorarlos. Usa herramientas como *required status checks* en CI.

## Conclusión

No tener tests es un problema visible: todo el mundo sabe que falta cobertura y puede priorizarlo. Tener tests que fallan sin motivo es un problema **invisible y corrosivo**: parece que tienes calidad, pero en realidad estás construyendo sobre arena.

La regla que yo aplico es sencilla: **la suite de tests debe ser verde, siempre, o no es una suite de tests, es ruido**. Un test inestable no protege tu código; te hace creer que estás protegido cuando no lo estás. Y esa ilusión, tarde o temprano, sale cara.

---

*¿Te ha pasado alguna vez? Cuéntame en los comentarios qué estrategia usáis en vuestro equipo para lidiar con los tests flaky.*
