---
title: "El test que miente: por qué una suite roja puede ser peor que no tener tests"
date: 2026-11-19
lang: es
tags: [testing, ci, calidad, ingeniería-de-software]
excerpt: "Un test que falla sin motivo hace más daño que un bug: erosiona la confianza, ralentiza al equipo y acaba matando la práctica de testear. Guía de síntomas, causas y reglas para que la suite vuelva a ser una red y no una alarma."
---

> Un test que falla te dice que algo está mal.
> Un test que falla *a veces*, *sin motivo aparente* o *siempre*, te dice que **ya no puedes fiarte de él**.
> Y un test en el que ya no confías no es un test: es ruido con presupuesto de CPU.

Hay una intuición muy extendida entre equipos junior: *"más tests es mejor"*. Con esa métrica, cualquier suite parece un éxito. Pero la realidad es que un test solo tiene valor si, cuando falla, cambia una decisión. Un test que falla sin cambiar nada —porque nadie lo lee, porque nadie sabe qué significa, porque nadie tiene tiempo de arreglarlo— tiene un coste positivo y un valor negativo.

Este post es un argumento a favor de una tesis incómoda: **en ciertas circunstancias, una suite de tests que falla de forma crónica es peor que no tener tests**. No es un argumento contra los tests, sino a favor de tests que *sean* fiables, o que no existan.

---

## 1. El problema no es el fallo: es la ambigüedad

Un test tiene dos salidas: verde o rojo. El rojo es el estado *deseable* cuando revela un defecto real, porque es una señal accionable: "algo cambió y no debería haber cambiado".

El problema aparece cuando el rojo deja de ser accionable. Si un test falla por razones que el equipo no puede reproducir, localizar y explicar, entonces el rojo deja de ser información y pasa a ser ruido. Y el ruido tiene un coste muy alto, porque el equipo paga por distinguir señal de ruido cada vez que corre la suite.

Piensa en la diferencia entre dos notificaciones:

| Escenario | Señal | Acción del equipo | Coste |
|---|---|---|---|
| Test rojo, causa clara y reciente | Real | Investigar y corregir | 5–30 min |
| Test rojo, causa desconocida | Ruido | Ignorar / reintentar / marcar como flaky | 2 h de debugging para nada |

Ese segundo escenario no es raro. En equipos medianos es la norma. Y ahí está la trampa: **no se trata de que el test sea rojo, se trata de que el equipo haya aprendido a ignorar el rojo**. Cuando eso ocurre, la suite sigue corriendo, sigue consumiendo minutos de CI, sigue ocupando RAM... y ya no cumple su función. Es un coste sin contrapartida.

## 2. Anatomía de un test que "falla a veces"

El test intermitente (*flaky*) es el caso más dañino, porque rompe la relación causa-efecto. Si el rojo es determinista, la gente aprende rápido. Si el rojo es aleatorio, la gente deja de aprender.

Causas habituales:

```ts
// 1. Dependencia del reloj real
test("caduca la oferta a medianoche", async () => {
  clock.setSystemTime(new Date("2026-01-01T00:00:01Z"));
  expect(await ofertaIsActiva(oferta)).toBe(false);
});

// 2. Dependencia de la red, del disco o de una API externa
const res = await fetch("https://api.proveedor.com/precios");

// 3. Dependencia del orden de ejecución o de estado compartido
// 4. Dependencia de la zona horaria del runner (CI en UTC, tu máquina en CET)
// 5. Carrera entre dos asíncronos sin sincronización
```

Todos estos casos comparten un patrón: **el test depende de algo que el test no controla**. El principio de diseño que se viola aquí es simple y antiguo:

> Un test debe ser una función determinista de su entrada.

Si el resultado depende del reloj, de la red, del orden o de la configuración regional del runner, ya no es una función: es una lotería con distribución conocida. Y una lotería no se puede usar como criterio de aceptación.

### La versión de "tests que pasan pero no verifican nada"

Hay un caso aún peor que el flaky: el test verde que no prueba nada. Si el rojo de un test es ruido, el verde es propaganda.

```ts
// Test tautológico: pasa siempre
expect(true).toBe(true);

// Test que solo comprueba que el mock se llamó
expect(repo.save).toHaveBeenCalled();

// Test que reimplementa la lógica del SUT en el test
const expected = computeDiscount(items, 10); // copia de la implementación
expect(computeDiscount(items, 10)).toEqual(expected);
```

Un test que no puede fallar es peor que un test que falla: ocupa la misma parte del presupuesto, da la misma falsa confianza y además **consume la atención del equipo cuando se rompe el código de verdad**, porque el equipo descubre que la cobertura era ficción.

Regla práctica: si no puedes señalar al menos un cambio en el código que rompería ese test, el test no existe.

## 3. El efecto erosión: por qué un único test tóxico contamina el conjunto

Los tests no son independientes: forman un sistema social. Y ahí hay una propiedad emergente que casi nadie documenta:

**La fiabilidad de la suite es (aproximadamente) el producto de la fiabilidad de sus tests.**

Si tu suite tiene 1.000 tests y el 5% es intermitente, tu probabilidad de tener un rojo espurio en una ejecución cualquiera es alta. Con 1.000 tests independientes al 95% de fiabilidad cada uno:

```
P(suite completamente verde) = 0.95^1000 ≈ 0.006
```

Es decir, **tu CI pasa limpio menos del 1% de las veces**. A partir de ese momento, el CI rojo deja de ser una señal: es el estado *normal*. Cuando el estado normal es rojo, aparece el fenómeno de la **alerta por fatiga** (*alert fatigue*), documentado en la aviación y en la medicina de urgencias: cuando la alarma suena el 40% de las veces, la gente deja de mirar la pantalla.

Y aquí está el golpe de gracia. Un CI que falla el 99% de las veces se resuelve de la forma más lenta posible: **con un botón de "re-run"**. Un re-run es el reconocimiento tácito de la derrota:

- El pipeline tarda el doble, el triple, lo que haga falta.
- Nadie mira el log. Nadie distingue el fallo real del fallo espurio.
- Cuando *sí* hay un fallo real, nadie lo ve: estaba escondido detrás de los otros doce.
- Y, peor: **nadie vuelve a escribir tests nuevos**. Si el equipo ha interiorizado que "tests = ruido + demora", el test se percibe como coste puro y la cobertura del repo se congela. Has perdido el valor futuro del testing, no solo el presente.

### El caso límite: la suite roja permanente

Hay un estado degenerado y muy reconocible: la rama `main` está rota desde hace semanas. Nadie la arregla. El equipo entra en la modalidad de "rojo permanente", donde el estado del CI ya no se consulta:

- Las alertas de CI se silencian o se silencian en el canal de Slack.
- Los nuevos miembros del equipo no saben si un rojo significa algo.
- Los merges se hacen con `--no-verify` o se desactiva el CI en el fork.
- Cuando ocurre un incidente real, nadie distingue "el CI estaba roto de siempre" de "el CI se acaba de romper".

En ese estado, los tests ya no son una red de seguridad: son **ruido con presupuesto de CI**. Y el presupuesto de CI no es gratis: son minutos de runner, dinero de la plataforma y, sobre todo, tiempo de latencia en cada pull request. Un PR que tarda 25 minutos en "pasar" tiene un coste real en el tiempo de revisión y en el tiempo de integración de cambios. Nadie contabiliza ese coste, porque aparece como "el CI tardó".

## 4. Por qué "no tener tests" puede ser mejor

El argumento extremo es el de la ausencia total: sin tests, el fallo aparece en producción. Eso es cierto y es gravísimo. Pero el argumento intermedio es más preciso y más útil:

> **Un contrato fiable pero incompleto es más valioso que un contrato completo pero caprichoso.**

Comparte el coste de un test que nunca ha funcionado con el de uno que falla de forma intermitente, y el primero te da una falsa señal que nadie usa.

Piénsalo como cualquier otro sistema de medición. Un sensor que a veces marca 0 y a veces marca 100 no es "medio fiable": es peor que un sensor que marcara siempre 50, porque el primero te hace *tomar decisiones* con información falsa. En tu caso:

| | Sin tests | Suite roja crónica | Suite verde fiable |
|---|---|---|---|
| Señal de regresión | Ausente | Presente pero inutilizable | Presente y accionable |
| Latencia de detección | Alta (producción) | Indefinida | Baja |
| Coste por ejecución | ~0 | Alto (CI + triaje + re-runs) | Moderado |
| Capacidad de refactorizar | Baja | Baja | Alta |
| Crecimiento del codebase | Caótico | Caótico | Ordenado |

La columna intermedia es la trampa. Y hay una paradoja amarga: **la suite roja crónica suele ser más cara que no tener tests**, porque el equipo paga la infraestructura (CI, reporters, plugins, triaje, re-runs) *y* el coste de no tener la red de seguridad.

## 5. Las cuatro causas raíz del rojo crónico

Cuando una suite está enferma, el diagnóstico casi siempre cae en una de estas cuatro categorías:

**a) Tests acoplados al entorno.** Dependen del reloj, de la red, del orden, del filesystem o de variables de entorno de la máquina de cada uno. Se arregla con inyección de dependencias: tiempo, red, ids y filesystem se pasan como parámetros explícitos y se usan dobles deterministas en los tests.

**b) Tests acoplados a la implementación.** Afirman sobre nombres de funciones privadas, sobre el número de llamadas a una dependencia, sobre la forma de un objeto interno. Se rompen con refactors inocuos. Se arregla con afirmaciones sobre comportamiento observable: entradas, salidas y efectos visibles.

**c) Tests mal diseñados que nunca funcionaron.** Duplicados, redundantes, copiados y pegados de un ejemplo de documentación que no compila. Se detectan con mutation testing o, más barato, con la pregunta de la sección 2: *¿qué cambio rompería esto?*.

**d) Deuda de mantenimiento sin dueño.** La suite creció a 5.000 tests y nadie tiene tiempo de actualizarlos cuando cambia una API interna. Se resuelve con política, no con heroísmo (ver más abajo).

## 6. Señales de alarma: cómo saber que tu suite está enferma

Esta checklist es sorprendentemente predictiva. Si marcas más de tres, tienes un problema estructural:

- [ ] El equipo **re-lanza** el pipeline antes que mirar el log.
- [ ] Alguien ha pedido **desactivar una parte de la suite** "porque tarda mucho" y nadie protestó.
- [ ] Hay tests marcados como `@skip`, `xfail` o "quarantine" que llevan **semanas** sin revisarse.
- [ ] Nadie sabe decir cuál es el **tiempo de ejecución total** de la suite, ni cuál fue el mes pasado.
- [ ] Nadie puede afirmar con datos **qué porcentaje de la suite ha fallado el mes pasado**.
- [ ] El equipo **no distingue** entre "el CI está roto" y "el CI está en rojo".
- [ ] Nadie recuerda la última vez que un test **rojo bloqueó un merge** y que fuera un bug real.
- [ ] La **cobertura** se mide, pero no se usa para nada: nadie sabe qué partes del código no cubren los tests.

Y un indicador cuantitativo que casi nadie mide y que vale la pena medir desde mañana:

> **Flake rate** = (ejecuciones de CI en rojo) / (ejecuciones totales)

Un equipo sano está por debajo del 1–2%. Si estás en el 10%, tu suite no está probando tu software: te está devorando el día.

## 7. Reglas para que la suite sea una red y no una alarma

Esto es lo que funciona en la práctica, y va de política más que de herramientas.

### 7.1 Nada entra en la suite si no es determinista

Antes de escribir un test, pregúntate cómo podría fallar sin que el código esté mal. Si la respuesta es "por un timing, por la red, por el orden", el test no se escribe así: primero se hace determinista.

```ts
// ❌ Test dependiente del reloj del sistema
expect(new Date() < deadline).toBe(true);

// ✅ Tiempo inyectado
const now = new Date("2026-03-01T10:00:00Z");
expect(isExpired(offer, now)).toBe(true);
```

### 7.2 El test debe poder fallar

Si mutas una línea y el test sigue verde, ese test no vale su coste. Herramientas como Stryker (JS), mutmut (Python) o Cosmic Ray dan una señal objetiva. No hace falta mutar el 100% del código: con una muestra aleatoria del 10% ya descubres los tests tautológicos.

### 7.3 Nada de sleeps ni de esperas por tiempo

`await sleep(500)` es una apuesta con el reloj. Si necesitas esperar, **espera a la condición**, no al tiempo:

```ts
// ❌
await sleep(500);
expect(status).toBe("done");

// ✅
await waitFor(() => status === "done", { timeout: 2000 });
```

### 7.4 Un test rojo es un bug *en el repositorio*, no un evento del mundo

Ni "es que el entorno de CI es raro", ni "ha sido un problema de red". Si el rojo no está causado por un cambio tuyo, es porque el test era frágil y ahora lo sabes. Eso no es una excusa, es información.

### 7.5 Divide la suite en niveles con distinta severidad

Este es el cambio con mejor relación coste/beneficio:

- **Nivel 0 — Smoke (bloqueante, < 5 min).** Build, arranque, healthcheck y un puñado de casos críticos. Debe ser casi imposible que falle.
- **Nivel 1 — Rápidos (bloqueante, < 15 min).** La mayor parte de la suite unitaria. Sin flake.
- **Nivel 2 — Integración / E2E (informativo, no bloqueante).** Aquí es razonable que viva el flaky; se ejecuta en nightly o post-merge y **nunca bloquea a nadie**.

La regla que lo hace funcionar: **lo que bloquea un merge tiene que ser de una fiabilidad casi perfecta**. Un gate que falla el 5% de las veces no es un gate, es un incremento de fricción que entrena al equipo a hacer push --force o a pedir excepciones.

### 7.6 Presupuesto de flakiness y cuarentena con caducidad

- Detecta intermitencia de forma automática: re-ejecuta los tests rojos una vez y, si pasan, el primero queda marcado como **flaky**.
- Quarantena: un test en cuarentena **no bloquea** la integración, pero se cuenta y se revisa semanalmente.
- **Caducidad obligatoria**: ningún test en cuarentena más de X días (una semana, quince días). Si no se arregla, **se borra**. Un test que nadie va a arreglar no vale su coste de mantenimiento, y mantenerlo da la falsa impresión de cobertura.

### 7.7 Regla de "si no lo arreglas, bórralo"

Esta es la más difícil de aceptar y la más valiosa. Un test que está roto desde hace seis meses no protege nada. Cuesta tiempo de ejecución, cuesta atención y, cada vez que alguien lo arregla, lo reintroduce.

La cobertura no es un inventario que haya que mantener a toda costa. La cobertura es una *estimación* de lo que tu suite verifica; dejarla pudrirse la convierte en una estimación falsa.

### 7.8 Presupuesto de tiempo de la suite

La suite debe caber en el tiempo de espera del equipo. Si la suite tarda 40 minutos, el equipo deja de correrla localmente y solo espera al CI, y entonces **toda la señal aparece tarde**, cuando ya has cambiado el contexto mental. Un developer que no ha ejecutado los tests en local ya ha roto el bucle de retroalimentación rápido, que es el motivo principal por el que existen los tests.

## 8. El bucle correcto

La forma sana de trabajar es un bucle corto y cerrado:

```
Escribir código  →  Ejecutar tests localmente  →  Fallo rápido  →  Corregir  →  Commit
                                   ↑
                            (segundos, no horas)
```

Un test rojo debe ser una **molestia barata**: cuesta segundos y da un mensaje claro. Cuando esa relación se invierte —el fallo cuesta media hora de triaje y un mensaje incomprensible— el bucle se rompe y la práctica se muere sola. Nadie deja de escribir tests por una decisión; se deja de escribir tests porque el sistema de retroalimentación dejó de funcionar.

La tesis final se puede resumir en una frase:

> **El objetivo de los tests no es tener tests: es que el rojo signifique algo.** Un rojo que significa algo vale más que cien tests verdes que no verifican nada. Y una suite cuyo rojo no significa nada es, desde el punto de vista del negocio, un gasto sin retorno.

---

### Bonus: cuatro preguntas que puedes hacerte hoy

1. **¿Cuánto tardó la última vez que un test rojo te paró a hacer algo?** Si la respuesta es "no me acuerdo", tu suite probablemente no bloquea nada y es decorativa.
2. **¿Puedes nombrar el último test que modificaste porque había fallado?** Si no puedes, tus tests no están influyendo en tu código.
3. **¿Cuántos tests fallarían si duplicaras una condición en el código?** Si la respuesta es 0, tu suite no está probando esa lógica.

Y una cuarta, la más incómoda:

4. **¿Qué pasaría si mañana apagaras la suite y apagaras el CI?** Si la respuesta es "cambiaría poco", tus tests no están haciendo su trabajo — y la suite roja crónica es exactamente ese estado: ruido caro en lugar de red útil.
