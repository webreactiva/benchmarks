# Por qué los tests que fallan a veces son peores que no tener tests

Todos hemos vivido esa escena. Abres una *pull request* con un cambio trivial —digamos, corregir un texto en un botón o ajustar una validación sencilla—, miras la pestaña de CI y ves una cruz roja. Abres los logs esperando encontrar un error tonto, pero el fallo viene de un módulo que ni siquiera has tocado. Frunces el ceño, pulsas **"Re-run failed jobs"** y, cinco minutos después, todo está en verde.

Respira aliviado el equipo, se hace *merge* y seguimos con nuestras vidas.

Acabas de cruzarte con un **flaky test** (un test intermitente o no determinista): una prueba que a veces pasa y a veces falla sin que el código haya cambiado. Y aunque a primera vista parezca un mal menor —"bueno, al menos tenemos tests"—, la realidad es mucho más incómoda: **una suite con tests que fallan a veces suele ser peor que no tener tests en absoluto**.

---

## La ilusión de la red de seguridad

Cuando un proyecto no tiene tests automatizados, todo el equipo es plenamente consciente del riesgo. Nadie asume que un cambio es seguro solo porque compila. Como sabes que caminas sin red, revisas el código con más atención, pruebas los flujos críticos manualmente, despliegas con cautela y monitorizas de cerca.

Con los *flaky tests*, ocurre lo contrario. Crees que tienes una red de seguridad, pero en realidad tienes una alarma de incendios que suena cada dos por tres cuando nadie está cocinando.

No tener tests te deja a ciegas, pero al menos sabes que estás a ciegas. Tener tests poco fiables te hace perder la confianza en tus propios instrumentos de navegación.

---

## 1. El síndrome de "Pedro y el lobo"

La función principal de una suite de tests no es generar un porcentaje bonito de cobertura; es **dar una señal clara e inequívoca** cuando algo se ha roto.

Cuando un test falla de forma aleatoria, rompe ese contrato:

* **La primera vez** que falla, investigas el código y pierdes media hora descubriendo que no era culpa tuya.
* **La tercera vez**, ya ni abres el log: pulsas *re-run* por reflejo.
* **La décima vez**, cuando el test falla por un bug real que alguien acaba de introducir, el reflejo sigue siendo el mismo: *"Bah, es el test ese que siempre falla, dale a reintentar"*.

En ese momento, el test ya no protege el sistema. Al contrario: entrena al equipo para ignorar los errores.

---

## 2. El coste oculto: tiempo, foco y dinero

Un fallo intermitente rara vez cuesta solo "los cinco minutos que tarda en volver a correr el CI". El coste real es acumulativo:

* **Pérdida de contexto (*context switching*):** Estabas concentrado en otra tarea, te llega la notificación de que el *build* ha fallado, vuelves mentalmente a la PR anterior, revisas logs, sospechas de tu propio código… solo para descubrir que era ruido.
* **Cuellos de botella en las entregas:** Si el *pipeline* tarda 15 minutos y hay un 10 % de probabilidad de que algún test aleatorio falle en cada ejecución, la probabilidad de que un *merge* salga a la primera cae en picado. Los reintentos multiplican los minutos de CI consumidos y retrasan despliegues urgentes.
* **Normalización de la mediocridad:** Poco a poco, el equipo acepta que "en verde al tercer intento" es el flujo normal de trabajo.

---

## 3. Ocultan bugs reales en producción

A veces, un test que falla una de cada veinte veces no tiene un problema en el código del test: **está intentando avisarte de un bug real en producción**.

Puede ser una *race condition* sutil, un problema de concurrencia al actualizar un recurso compartido o una consulta a base de datos cuyo orden depende de un índice. Pero como el equipo se ha acostumbrado a pulsar *re-run* hasta que el semáforo se ponga verde, ese aviso se barre debajo de la alfombra.

Sin tests, ese bug quizás habría exigido una prueba de carga o una revisión más exhaustiva. Con un test intermitente tratado como ruido, el bug llega a producción con el sello oficial de "todos los checks pasaron".

---

## De dónde suelen salir los tests intermitentes

Casi nunca es magia negra. Detrás de un test que falla a veces suele haber alguna fuente de no determinismo:

### 1. Esperas arbitrarias (`sleep`)

```javascript
// Mal: asumimos que 100 ms siempre bastan
triggerAsyncSave();
await sleep(100);
expect(database.count()).toBe(1);
```

En tu portátil con la batería cargada, 100 ms sobran. En un contenedor saturado de CI, la operación tarda 120 ms y el test falla.

**Alternativa:** esperar a la condición real (eventos, promesas, *polling* con *timeout* razonable) en lugar de adivinar cuánto tardará.

### 2. Dependencia del reloj o de la zona horaria

Tests que llaman directamente a `new Date()`, `Date.now()` o `datetime.now()` y fallan a medianoche, en cambios de hora o el 29 de febrero.

**Alternativa:** inyectar el reloj o congelar el tiempo en el entorno de pruebas.

### 3. Estado compartido entre tests

Un test crea un registro en base de datos, modifica una variable global o deja un fichero temporal, y no limpia al terminar. El test pasa si se ejecuta solo, pero falla si corre en paralelo o después de otro test concreto.

**Alternativa:** aislar cada test (transacciones revertidas, instancias limpias, directorios temporales únicos) y ejecutar la suite en orden aleatorio de vez en cuando para detectar acoplamientos ocultos.

### 4. Dependencias externas reales

Llamar a APIs de terceros, depender de la red o usar recursos compartidos entre distintas ejecuciones de CI.

**Alternativa:** usar dobles de prueba (*mocks*, *stubs*, servidores locales efímeros o contenedores aislados) para la suite rápida y reservar las pruebas contra servicios reales para entornos controlados.

---

## Qué hacer si ya tienes tests así

Si tu repositorio ya sufre de tests intermitentes, la peor estrategia es convivir con ellos en silencio. Algunas medidas prácticas:

1. **Tolerancia cero en la rama principal:** Un test no determinista no debe bloquear ni contaminar la señal del *pipeline* principal.
2. **Arréglalo o ponlo en cuarentena (o bórralo):** Suena radical, pero borrar un test crónicamente *flaky* que nadie va a arreglar esta semana suele ser mejor decisión que dejarlo pudriendo la confianza de todo el equipo. Si aporta valor real, sácalo temporalmente a una suite separada con un *issue* asignado y prioridad alta, o arréglalo en el acto.
3. **Mide los reintentos:** Si tu plataforma de CI permite reintentar automáticamente, registra qué tests necesitaron un segundo intento. Un test que "pasa al reintentar" sigue siendo un test roto; si lo ocultas con *auto-retries*, nunca sabrás cuánto te está costando.
4. **Reproduce en condiciones hostiles:** Ejecuta el test sospechoso 100 veces seguidas en un bucle o limitando CPU en local antes de darlo por arreglado.

---

## En resumen

El valor de una suite de tests reside en una sola palabra: **confianza**.

* Cuando no tienes tests, desconfías del código, pero al menos actúas en consecuencia.
* Cuando tienes tests que fallan a veces, desconfías de los tests. Y en cuanto un equipo deja de creer en sus propias pruebas, la suite entera se convierte en teatro: consume tiempo, cuesta dinero y ya no protege a nadie.

La próxima vez que veas un fallo "raro" en CI, resiste la tentación de pulsar *re-run* y seguir adelante. Cada vez que normalizas un test intermitente, estás enseñando a tu equipo que el color rojo no significa nada.
