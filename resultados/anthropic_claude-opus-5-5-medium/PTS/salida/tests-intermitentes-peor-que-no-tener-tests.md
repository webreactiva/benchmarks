---
title: "El test que falla a veces: por qué un test intermitente puede ser peor que ningún test"
date: 2026-11-20
tags: [testing, ci, calidad, buenas-prácticas]
description: "Los tests flaky no solo hacen perder tiempo: enseñan al equipo a ignorar las alarmas. Por qué pasa, cómo detectarlo y qué hacer al respecto."
---

# El test que falla a veces: por qué un test intermitente puede ser peor que ningún test

Son las seis de la tarde de un viernes. Abres tu pull request, la CI se pone en rojo y el error está en un test que no tiene nada que ver con tu cambio: `test_checkout_sends_confirmation_email`. Lo miras, frunces el ceño y haces lo que todos hemos hecho alguna vez: pulsas **"Re-run failed jobs"**. Verde. Merge. A casa.

Esa pequeña acción, repetida cientos de veces por todo un equipo, es una de las formas más silenciosas de destruir el valor de una suite de tests. Y la tesis de este artículo, aunque suene provocadora, es esta:

> **Un test que falla de forma intermitente puede ser peor que no tener ese test.**

No es una exageración retórica. Vamos a ver por qué.

---

## Qué es un test intermitente (flaky)

Un test *flaky* es aquel que, **con el mismo código y la misma configuración**, a veces pasa y a veces falla. No es un test que detecta un bug real; es un test cuyo resultado depende de algo que no controla: el reloj, el orden de ejecución, la red, la carga de la máquina, un estado compartido…

La clave está en la definición: si el resultado no depende del código, **el resultado no te dice nada sobre el código**.

---

## Un test es un instrumento de medida

La mejor forma de entender el problema es pensar en un test como en un detector de humo.

- Un detector que funciona bien suena cuando hay fuego y se calla cuando no lo hay.
- No tener detector es peligroso, pero al menos **sabes** que no lo tienes. Eres prudente con las velas.
- Un detector que suena aleatoriamente un par de veces por semana es peor: al cabo de un mes, cuando suena, nadie se levanta del sofá. Y el día que hay fuego de verdad, tampoco.

Ese es exactamente el efecto de un test flaky. El valor de un test no está en que exista, sino en la **información** que proporciona. Y un test cuyo fallo puede significar "hay un bug" o "ha habido mala suerte" proporciona muy poca información. Peor aún: da una **falsa sensación de seguridad**, porque en el informe de cobertura esa funcionalidad aparece como "testeada".

---

## Los costes reales (que casi nunca se miden)

### 1. Normaliza ignorar el rojo

Este es el daño principal y el más difícil de revertir. El primer día que alguien relanza un pipeline "porque ese test falla a veces", el equipo aprende una regla implícita: **un fallo en la CI no significa necesariamente que algo esté mal**.

Esa regla no se queda contenida en un test. Se contagia. Pronto se relanzan pipelines por cualquier fallo sin leer el error, porque "seguramente es el flaky de siempre". Y un día el fallo es real, se relanza, por casualidad pasa (porque el bug también es intermitente, como suelen serlo las condiciones de carrera) y el bug llega a producción con el sello de "todos los tests en verde".

### 2. Esconde bugs reales

Aquí hay una ironía cruel: muchos tests flaky **no son tests mal escritos, sino tests que han encontrado un bug real** que es difícil de reproducir. Una condición de carrera en tu código, un problema de zonas horarias, una dependencia del orden de inserción en un mapa…

Si la respuesta del equipo es reintentar o marcar el test como `@skip`, se está tirando a la basura precisamente la señal que más difícil era de obtener.

### 3. Tiempo y dinero

Cada reintento cuesta minutos de CI y, sobre todo, minutos de atención humana. Hagamos un cálculo conservador:

- Un equipo de 10 personas, 5 PRs al día cada uno.
- Un 10 % de los pipelines falla por un test flaky.
- Cada incidente cuesta 15 minutos entre investigar, relanzar, esperar y retomar el contexto.

Son **unas 12 horas de ingeniería a la semana**. Una persona y media dedicada a tiempo completo a pulsar "re-run". Y eso sin contar el coste de cambiar de contexto ni la frustración acumulada.

### 4. Erosiona la confianza en *toda* la suite

Cuando un equipo deja de confiar en sus tests, deja de escribirlos con cuidado, deja de mantenerlos y deja de usarlos como red de seguridad para refactorizar. La suite se convierte en un trámite burocrático en lugar de en una herramienta. Una manzana podrida, en este caso, sí estropea el cesto.

---

## Las causas más habituales

Casi todos los tests intermitentes caen en alguna de estas categorías:

### Esperas basadas en tiempo

El clásico absoluto:

```python
def test_job_finishes():
    start_background_job()
    time.sleep(2)  # "debería bastar"
    assert job_status() == "done"
```

En tu portátil tarda 300 ms. En un runner de CI compartido, con otras veinte tareas compitiendo por la CPU, a veces tarda 2,1 segundos.

**Mejor:** esperar a una condición, con un timeout generoso, en lugar de esperar un tiempo fijo.

```python
def test_job_finishes():
    start_background_job()
    wait_until(lambda: job_status() == "done", timeout=30)
```

El timeout largo no hace el test más lento cuando todo va bien; solo evita falsos negativos cuando la máquina va cargada.

### Dependencia del reloj real

```javascript
test("muestra 'hoy' para fechas de hoy", () => {
  const order = createOrder();          // usa new Date()
  expect(formatDate(order.createdAt)).toBe("hoy");
});
```

Este test falla si se ejecuta justo a medianoche, o si el servidor de CI está en UTC y el código asume la hora local. **Solución:** inyectar el reloj o congelarlo (`jest.useFakeTimers()`, `freezegun`, un `Clock` inyectable…).

### Estado compartido y orden de ejecución

Un test escribe en una base de datos, en una variable global o en un fichero temporal, y otro test asume que ese estado está limpio. Cuando el runner ejecuta en paralelo o en orden aleatorio, la cosa explota.

**Solución:** cada test prepara y limpia su propio estado. Si tu framework permite aleatorizar el orden de ejecución (`pytest-randomly`, `--order=rand` en RSpec, `-shuffle` en Go), actívalo: convertirá fallos misteriosos en fallos reproducibles.

### Dependencias externas reales

Tests que llaman a una API de terceros, a un servicio de staging o a internet en general. Esa API tiene su propia disponibilidad, sus propios límites de peticiones y sus propios días malos.

**Solución:** dobles de test o servidores falsos en los tests unitarios y de integración; y un conjunto pequeño y separado de tests de contrato o *smoke tests* contra el servicio real, que no bloqueen cada PR.

### Aleatoriedad sin semilla fija

Datos generados aleatoriamente que, una vez de cada mil, producen un caso límite (una cadena vacía, un número negativo, dos IDs iguales). Paradójicamente, esto a menudo **sí** es un bug real del código. Fija la semilla e imprímela en el log cuando el test falle, para poder reproducir el caso exacto.

### Concurrencia

Hilos, promesas, eventos asíncronos y colas. Los tests de código concurrente que no sincronizan correctamente son la fuente más difícil de depurar… y la más probable de estar escondiendo un bug de verdad.

---

## Qué hacer con un test flaky

### 1. Política de tolerancia cero (pero realista)

"Tolerancia cero" no significa que nunca vaya a haber tests intermitentes; significa que **ninguno se queda viviendo en la suite principal sin dueño**. Cuando se detecta uno, hay que elegir una de tres opciones, rápido:

1. **Arreglarlo** ahora, si es sencillo.
2. **Ponerlo en cuarentena**: sacarlo del conjunto que bloquea el merge, crear una incidencia con un responsable y una fecha, y seguir ejecutándolo aparte para recoger datos.
3. **Borrarlo**, si nadie es capaz de explicar qué protege o si su coste supera claramente su valor.

Lo que no es una opción es dejarlo donde está, fallando un 5 % de las veces, para siempre.

### 2. La cuarentena no es un cementerio

El riesgo de la cuarentena es que se convierta en el lugar donde los tests van a morir. Algunas reglas útiles:

- Cada test en cuarentena tiene una incidencia asociada y una persona responsable.
- Hay un límite de tiempo (por ejemplo, dos semanas). Si se cumple, se arregla o se borra.
- La lista de tests en cuarentena es visible: en un dashboard, en la reunión semanal, donde sea. Lo que no se ve, no se arregla.

### 3. Cuidado con los reintentos automáticos

Muchos frameworks ofrecen reintentar automáticamente los tests fallidos (`retries: 2`, `pytest-rerunfailures`, `@RepeatedTest`…). Es tentador, porque hace desaparecer el problema de la vista. Y ese es justamente el problema.

Los reintentos son aceptables **solo si**:

- Se registra cada test que necesitó un reintento para pasar.
- Alguien revisa ese registro con regularidad.
- Se usan como medida temporal, no como solución.

Un reintento silencioso es la versión automatizada de pulsar "re-run" sin leer el error: tiene todos los inconvenientes y además es invisible.

### 4. Mide la intermitencia

No puedes arreglar lo que no ves. Algunas ideas baratas:

- Guarda el historial de resultados por test. Un test que ha fallado y pasado en el mismo commit es, por definición, flaky.
- Ejecuta la suite completa varias veces seguidas de forma periódica (por ejemplo, cada noche, sin cambios de código) y anota qué falla.
- Para investigar un sospechoso, ejecútalo en bucle: `pytest --count=200 -x tests/test_checkout.py` (con `pytest-repeat`), `go test -count=500 -run TestCheckout`, o un simple `for` en bash.

### 5. Cuando lo investigues, sospecha primero del código

Antes de concluir que "el test está mal escrito", pregúntate si el código bajo prueba tiene una condición de carrera, un problema de zonas horarias o un estado global. Una buena parte de los tests intermitentes son, en realidad, **el único aviso que tienes de un bug que tus usuarios también ven de vez en cuando** y que nunca has sabido reproducir.

---

## Entonces, ¿borro los tests?

No. El título de este artículo es "a veces son peores que no tener tests", no "es mejor no tener tests". La conclusión no es escribir menos tests, sino entender qué hace valioso a un test:

- Un test valioso es **determinista**: mismo código, mismo resultado.
- Un test valioso es **creíble**: cuando falla, todo el mundo asume que hay un problema real y se para a mirarlo.
- Un test valioso es **barato de mantener** en relación con lo que protege.

Un test flaky no cumple la segunda propiedad, y al dejar de cumplirla arrastra la credibilidad de todos los demás. Por eso, cuando un test no puede ser determinista y no vas a dedicar tiempo a que lo sea, borrarlo puede ser **la decisión más honesta**: al menos el equipo sabrá que esa parte no está cubierta y actuará en consecuencia.

---

## Resumen

- Un test es un instrumento de medida: su valor es la información que da. Un test intermitente da información poco fiable.
- El mayor daño no es el tiempo perdido, sino la **cultura de ignorar el rojo** que genera.
- Las causas típicas son esperas con `sleep`, dependencia del reloj, estado compartido, servicios externos, aleatoriedad sin semilla y concurrencia.
- Ante un test flaky: arréglalo, ponlo en cuarentena con dueño y fecha, o bórralo. Nunca lo ignores.
- Los reintentos automáticos solo son aceptables si son visibles y temporales.
- Antes de culpar al test, sospecha del código: puede que el test tenga razón.

La próxima vez que estés a punto de pulsar "re-run" un viernes a las seis de la tarde, para un segundo y lee el error. Puede que sea mala suerte. O puede que sea el detector de humo haciendo, por fin, su trabajo.
