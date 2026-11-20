Los tests inestables son el cáncer silencioso de tu suite de testing.

No es una exageración. Un test que falla el 5% de las veces es más dañino que no tener ese test en absoluto. Y sin embargo, la mayoría de equipos convive con ellos durante meses, añadiendo "reintentar" en el CI como si fuera una feature.

En este post veremos:

- Por qué la **confianza** es la métrica real de tu suite de tests
- El coste psicológico de los falsos positivos en el equipo
- Cómo los tests inestables destruyen la cultura de **refactorización**
- Estrategias para detectarlos, aislarlos y matarlos
- Cuándo está justificado borrar un test sin reemplazarlo

---

## ¿Qué es exactamente un test inestable?

Un **test inestable** (o *flaky test*) es aquel que produce resultados inconsistentes: a veces pasa, a veces falla, sin que el código bajo prueba haya cambiado.

No hablo de tests que fallan porque hay un bug real. Hablo de tests que fallan por:

- **Race conditions** en código asíncrono
- **Dependencias externas** inestables (red, base de datos, APIs de terceros)
- **Estado compartido** entre tests (variables globales, singletons, bases de datos sucias)
- **Timing** arbitrario (timeouts hardcodeados, esperas fijas)
- **Orden de ejecución** no determinista
- **Recursos limitados** en CI (memoria, CPU, puertos)

La característica definitoria: **ejecutas el mismo commit diez veces y obtienes resultados distintos**.

---

## El coste real no es el tiempo de CI

La mayoría de equipos calcula el coste de los tests inestables en minutos de pipeline desperdiciados. Error.

El coste real es **la erosión de la confianza**.

Cuando un test falla y el desarrollador piensa "seguro que es flaky, lo reintento", has perdido la partida. Ese momento —ese milisegundo de duda— es donde muere la utilidad de tu suite.

> 🔑 **La regla de oro**: un test que no confías es peor que no tener test. Porque te da **falsa seguridad**.

Piénsalo. Si no tienes test, sabes que no tienes red de seguridad. Vas con cuidado. Si tienes un test inestable que "suele pasar", te crees protegido. Y entonces refactorizas, despliegas, rompes producción.

---

## La psicología del "reintentar"

He visto pipelines con `retry: 3` en la configuración de GitHub Actions. Tres reintentos. Por defecto.

Eso no es una red de seguridad. Es **un vendaje en una herida que supura**.

Cada vez que un desarrollador ve el badge verde tras un reintento, aprende tres cosas tóxicas:

1. **Los tests mienten**. No reflejan la realidad del código.
2. **La calidad es negociable**. Si el CI pasa tras reintentar, "ya está bien".
3. **Investigar fallos es opcional**. Total, "se arregla solo".

Esto crea una **cultura de ignorancia selectiva**. El equipo deja de leer los logs de CI. Deja de investigar fallos intermitentes. Y cuando llega el fallo real —el que no se arregla reintentando—, nadie lo detecta a tiempo.

> ⚠️ **Dato**: Según el *State of Testing 2023* de JetBrains, el 63% de los equipos admite tener tests inestables en su suite principal. Solo el 12% tiene un proceso activo para eliminarlos.

---

## Cómo matan la refactorización

La refactorización requiere una premisa: **los tests te avisan si rompes algo**.

Si tus tests fallan "a veces", esa premisa se rompe. Imagina este escenario:

1. Cambias una función interna para mejorar rendimiento
2. Ejecutas tests: uno falla
3. Piensas: "bah, ese test es flaky"
4. Reintentas: pasa
5. Haces commit y deploy
6. En producción: **bug real** que el test *habría* pillado si fuera fiable

El test inestable te ha **robado la capacidad de refactorizar con confianza**. Y sin refactorización, tu código se pudre. La deuda técnica se acumula. El miedo a tocar código crece.

> 💡 **Si no puedes refactorizar sin miedo, tus tests no sirven para nada**. Da igual que tengas 80% de cobertura. Da igual que uses TDD. La cobertura de tests inestables es **cobertura teatral**.

---

## La falacia del "test mejor que nada"

"Mejor un test inestable que ningún test" —falacia clásica.

No es cierto. Un test inestable **resta valor**. Porque:

- Consume tiempo de CI (y dinero)
- Consume atención mental del equipo
- Desvía investigación hacia falsos positivos
- Crea dependencia falsa: "este módulo está testeado" (mentira)
- Bloquea la adopción de testing serio: "ya probamos testing y no funciona"

He visto equipos **tirar suites enteras** y empezar de cero porque la proporción de tests inestables superaba el 30%. Y tenían razón: era más rápido reescribir que sanear.

---

## ¿Cómo detectarlos? (sin volverte loco)

No necesitas tooling caro. Empieza por lo básico:

### 1. Ejecuta en bucle local

```bash
# Ejecuta el test 50 veces seguidas
for i in {1..50}; do npm test -- --testNamePattern="mi test"; done
```

Si falla al menos una vez: **es inestable**. Punto.

### 2. Aísla en CI

Crea un job que ejecute **solo tests sospechosos** en bucle durante 30 minutos. Los que fallen, a la lista negra.

### 3. Métricas simples

Añade a tu CI un contador: `flaky_count` que incrementa cada vez que un test pasa en reintento. Si supera umbral (ej. 3 fallos en 20 runs), **bloquea el merge** y asigna owner.

> 🛡️ **Regla práctica**: un test que ha fallado por inestabilidad más de 2 veces en el último mes **no se mergea hasta que se arregla o se borra**.

---

## Estrategias para matarlos (en orden de preferencia)

### 1. Arregla la causa raíz (ideal)

- Race condition → sincronización correcta, no `sleep`
- Estado compartido → cleanup en `beforeEach`/`afterEach`, bases de datos en memoria por test
- Timing → espera condiciones, no tiempo fijo
- Orden → tests independientes, sin side effects

### 2. Aísla y quarantena

Si no puedes arreglarlo **ya**:

```yaml
# En tu CI: job separado, no bloqueante
flaky-tests:
  runs-on: ubuntu-latest
  steps:
    - run: npm test -- --testPathPattern="flaky/"
  # No hace fail al pipeline principal
```

Y **pon fecha de caducidad**. "Este test se borra el 15 de marzo si nadie lo arregla". Cumple la amenaza.

### 3. Bórralo sin piedad

Sí, lo he dicho. **Bórralo**.

> 🔑 **Un test inestable que nadie arregla en 2 semanas no vale la pena mantener**. El coste de oportunidad de mantenerlo supera su valor teórico.

He borrado tests que "cubrían funcionalidad crítica". ¿Resultado? Nada se rompió. Porque **si nadie los arregla, nadie confía en ellos**. Y si nadie confía, no protegen nada.

---

## Cuándo está justificado no tener test

Hay casos donde **no testear es mejor que testear mal**:

- **Código throwaway**: prototipos, spikes, experiments que se tiran en días
- **Capa de UI muy volátil**: donde los selectores cambian cada sprint y el coste de mantenimiento supera el valor
- **Integraciones legacy sin control**: APIs de terceros sin sandbox, donde cualquier test es inherentemente inestable
- **Código generado**: si se regenera, los tests se rompen por definición

En estos casos, **documenta por qué no hay test**. "Sin test: integración con API externa sin entorno de pruebas estable. Ver ticket #1234 para reevaluar en Q2."

Es honesto. Es rastreable. Y no envenena tu suite.

---

## El test de la verdad: ¿confiarías en este test para hacer deploy un viernes a las 17:00?

Si la respuesta no es un **sí rotundo**, el test tiene un problema.

No hace falta que sea inestable. Puede ser:
- Lento (tarda 10 minutos → no lo ejecutas antes de deploy)
- Frágil (se rompe por cambios cosméticos → lo ignoras)
- Opaco (fallos crípticos → no sabes qué arreglar)

La métrica única de calidad de tu suite: **¿me fío lo suficiente para deployar sin revisar manualmente?**

---

## TL;DR

- 🧪 **Tests inestables destruyen la confianza** —la única métrica que importa en testing
- 🧠 **El coste psicológico** supera al de CI: el equipo aprende a ignorar fallos
- 🛠️ **Matan la refactorización** porque no puedes distinguir fallo real de ruido
- 🔍 **Detéctalos ejecutando en bucle** (50 veces local, job dedicado en CI)
- 🗑️ **Bórralos sin piedad** si no se arreglan en 2 semanas: restan valor neto

---

## FAQ

### ¿Qué porcentaje de tests inestables es "aceptable"?

**Cero**. Cualquier test inestable en tu suite principal degrada la confianza del equipo. La tolerancia debe ser cero en la rama principal.

### ¿Vale la pena invertir en tooling anti-flakiness (como buildpulse, etc.)?

Solo si ya has agotado lo básico: aislamiento, cleanup, esperas condicionales. El tooling detecta, no arregla. Arreglar requiere cambios en el código de test o producción.

### Mi equipo dice "no tenemos tiempo para arreglar tests inestables"

Entonces **no tienen tiempo para testing**. Prioriza: o arreglas los tests inestables esta sprint, o asumes que tu suite no es fiable y dejas de usarla como criterio de calidad. No puedes tener las dos.

### ¿Los tests de integración son inherentemente más inestables?

Son más *propensos* a inestabilidad por dependencias externas. Pero **no tienen por qué serlo**. Bases de datos en memoria, mocks de red deterministas, testcontainers bien configurados —todo eso elimina la mayor parte de la inestabilidad.

### ¿Cómo convenzo a mi lead/manager de que borrar tests es bueno?

Muéstrales el coste: horas de CI desperdiciadas, tiempo de investigación en falsos positivos, deploys fallidos que "pasaron CI". Cuantifica. "Este test inestable nos ha costado 40h este mes. Borrarlo cuesta 0h y elimina el ruido."

### ¿Qué hago con tests heredados de un legacy sin dueño?

Aísla, monitoriza 2 semanas, borra los que fallen. Si nadie reclama en 30 días, no eran importantes. Documenta la decisión en el README del repo.

### ¿Es flakiness lo mismo que tests lentos?

No. Un test lento pero determinista es **molesto**, no **peligroso**. Un test rápido pero inestable es **peligroso**. Prioriza arreglar inestabilidad sobre velocidad.

### ¿Debo escribir tests para detectar flakiness en otros tests?

No. Eso es recursión infinita. Arregla la causa raíz: aislamiento, determinismo, cleanup. El meta-testing no escala.

### ¿Cuál es la señal más clara de que mi suite tiene demasiados tests inestables?

Cuando un desarrollador dice "voy a reintentar el pipeline" **sin leer el log de error**. Ese momento es el canario en la mina.

---

## Fuentes

- *State of Testing 2023* — JetBrains Developer Ecosystem Survey
- *Flaky Tests at Google* — Google Testing Blog (2017)
- *An Empirical Study of Flaky Tests* — Luo et al., ICSE 2014
- *Testing Strategy at Netflix* — Netflix Tech Blog (2021)
- *The Cost of Flaky Tests* — Martin Fowler, Bliki (2019)