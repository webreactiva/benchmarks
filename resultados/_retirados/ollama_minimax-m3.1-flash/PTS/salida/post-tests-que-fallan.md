---
title: "Por qué un test que falla es peor que no tener tests"
date: 2026-11-20
tags: [testing, tdd, ingenieria-de-software, deuda-tecnica]
excerpt: "Un test rojo no es un test roto: es una promesa rota. Y las promesas rotas cuestan más caro que la ausencia de promesa."
---

# Por qué un test que falla es peor que no tener tests

> «Prefiero un test que falla a no tener ningún test.»

He escuchado esa frase en casi todas las reuniones de equipo donde se habla de testing. Es intuitiva y, en la mayoría de los casos, falsa. El razonamiento que hay detrás suena así: *el test falla → descubres un bug → lo arreglas → el mundo es un lugar mejor*. Suena razonable. Pero el razonamiento esconde tres supuestos que no se cumplen:

1. Que el fallo del test señala **un** bug real y no un test mal escrito.
2. Que vas a **arreglar** ese bug en lugar de adaptarte a él.
3. Que el coste de mantener el test (y el ruido que genera) es menor que el beneficio de detectarlo.

El primer supuesto es el más caro. El segundo es el más común. Y los dos juntos producen un efecto que ningún manual de testing menciona: **una suite roja crónica que todo el mundo aprende a ignorar**.

Antes de entrar en materia, conviene distinguir tres cosas que se confunden todo el tiempo:

| Situación | Qué es | ¿Debería seguir en `main`? |
|---|---|---|
| **Test rojo en CI** | Alguien rompió algo | Depende del tiempo de respuesta |
| **Test rojo conocido y documentado** | El código tiene un bug reconocido | No, casi nunca |
| **Test rojo deliberado** (TDD) | Todavía no has escrito la implementación | Sí, es el punto de partida |

La tercera fila es la única en la que el fallo es **información** y no **ruido**. Las dos primeras son, en el mejor de los casos, la antesala de algo peor.

---

## 1. El contrato implícito de un test

Un test verde no es solo un test que pasa. Es una **afirmación sobre el comportamiento del sistema** que se promulgó en algún momento y que el resto del equipo acepta como verdadera:

> «Este endpoint devuelve 200 y un JSON con esta forma cuando el usuario está autenticado.»

Un test rojo es una afirmación que el código ya no sostiene. Y aquí está la trampa: **tú no eres el único que lee la suite**. En un equipo de diez personas hay:

- quien lee los logs de CI para ver si «todo va bien»,
- quien ejecuta el suite localmente antes de hacer push,
- quien configura una alerta de integración continua que nadie mira,
- quien revisa el PR y ve un test marcado como *skipped* o `xfail`,
- quien hereda el repositorio dentro de seis meses y se pregunta qué hace ese bloque de código.

Para todos ellos, la suite **verde** significa «puedo continuar». La suite **roja** significa «algo que no me concierne». Cuando una suite está crónicamente roja, ese «algo que no me concierne» se convierte en el estado por defecto, y la señal más valiosa que tenía tu infraestructura —*se rompió algo, míralo*— se evapora.

Un test rojo crónico es un **falso positivo constante**. Y un falso positivo constante es peor que un falso positivo ocasional, porque entrena a tu equipo a ignorar el canal.

---

## 2. Los cuatro costes concretos

### 2.1 La normalización del fallo (*alert fatigue*)

El primer rojo duele. El segundo se investiga. El séptimo se salta con un `git bisect` mental que nadie documenta. El trigésimo se marca como «fallo conocido» en un comentario al lado del test.

El proceso de degradación es siempre el mismo y es bien conocido en incident management:

```
rojo nuevo  →  "uy, algo se rompió"  →  se arregla          (coste: horas)
rojo conocido → "ese de siempre"      →  se documenta       (coste: minutos)
rojo crónico → "ese de siempre"      →  se ignora          (coste: 0)
```

El problema es que ese coste decreciente es una **mentira contable**. El coste no cae a cero: se **traslada**. Se traslada al siguiente bug real, al incidente de producción del martes, al refactor que nadie se atrevió a tocar porque la suite ya era roja y «no se sabía qué estaba roto».

> Cuando la suite está crónicamente roja, cada fallo real se convierte en el vigésimo desconocido. Y los desconocidos no se depuran.

### 2.2 El coste de oportunidad: el test como *blocker*

Un test que falla y que nadie va a arreglar no es neutro: es un **bloqueo**. No bloquea el código, pero bloquea el proceso:

- **El PR queda en rojo.** Fusión con comprobación obligatoria → todo el mundo pide excepciones hasta que la comprobación se vuelve decorativa.
- **El pipeline falla.** El deploy automático se detiene. Un equipo que necesita 40 deploys al día y tiene uno rojo aprende a no mirar el pipeline.
- **El binario no se publica.** Si el rojo viene de un entorno (una API externa caída, una feature flag apagada), el equipo empieza a hacer deploy manuales «a ciegas». ¿Para qué automatizaste si terminas igual o peor?

Este es el punto que más se subestima: **el pipeline de CI es un producto interno con clientes** (tus compañeros). Un pipeline que se rompe solo entrena a sus clientes a saltárselo. De la misma forma que una alarma de coche que salta con cada roce no protege el coche: lo hace ignorar.

### 2.3 El test zombi: rojo que ya no informa nada

Cuando un test se pone rojo y no se arregla, empieza un ciclo de degradación semántica:

```python
# Día 1: el test falla y señala un problema real
def test_refund_exceeds_charge():
    order = Order(total=100, refunded=150)
    assert order.is_valid()   # FAIL: la validación no comprueba el reembolso

# Día 30: alguien "arregla" el test en vez de arreglar el código
def test_refund_exceeds_charge():
    order = Order(total=100, refunded=150)
    assert not order.is_valid()   # PASS: ahora afirma lo contrario
```

Ese cambio es **peor** que borrar el test. Antes el test era una alarma; ahora es una alarma que dice «todo correcto» mientras el bug sigue vivo. Has convertido una prueba en un mentiroso. Y un mentiroso automatizado es una forma muy eficiente de propagar el bug a otras partes del sistema: si otros tests usan `Order.is_valid()` como precondición, arrastran el defecto con ellos.

La variante más común y más difícil de detectar:

```python
@pytest.mark.skip(reason="flaky, arreglar en Q3")
def test_concurrent_payments():
    ...
```

Un `skip` no falla, así que la suite está «verde». Pero has convertido un test **activo** en un test **ausente**, sin que nadie lo note, y has creado una deuda con fecha de caducidad que nadie va a pagar.

### 2.4 La erosión del modelo mental

Un test que afirma algo que ya no es cierto no solo ocupa tiempo: **desorienta**. El modelo mental del equipo sobre el sistema se construye, en buena parte, sobre los tests. Cuando el suite describe un sistema que no existe, cada ingeniero nuevo aprende un sistema imaginario.

Y hay un efecto de pérdida de confianza: si el equipo no puede confiar en los tests, **no escribe tests**. Es una espiral: menos confianza → menos tests → menos confianza. El resultado final es el escenario peor que la frase «prefiero un test que falla» intenta evitar: **no tener tests**, pero además haber gastado meses en construir y mantener la infraestructura que produce los que fallan.

---

## 3. El caso especial: el test *flaky*

Un test flaky (pasa y falla sin cambios en el código) merece una sección propia porque es la forma más insidiosa del problema.

Un test flaky tiene tres efectos, todos|scale-targeted:

1. **Destruye el valor de la suite.** Un canal que a veces miente es peor que un canal que nunca existe. Empiezas a re-ejecutar («dale otra vez») y a hacer *rerun* en CI hasta que salga verde. Ese *rerun* es el momento en el que el CI deja de ser un verificador y se convierte en una ruleta.
2. **Se propaga como una plaga.** Cuando un test flaky rompe el pipeline, la respuesta a corto plazo más rápida es: «este test es raro, lo marcamos flaky y seguimos». Ahora tienes un test que nunca falla y nunca verifica. La plaga se expande: cada test problemático se marca, y la suite se convierte en un cementerio de comprobaciones desactivadas.
3. **Mata la cultura de “CI verde = desplegable”.** El equipo pierde el reflejo de arreglar las cosas antes de fusionar.

La regla práctica, y esta sí es una regla dura:

> Un test flaky no es un test pendiente. Es un test **roto**, con una diferencia: que rompe en lugar de avisar.

La causa más común de flakiness es siempre la misma: **el test depende de algo que no controla** — una hora del sistema, un orden de ejecución, un recurso compartido, una llamada de red, un `sleep` en lugar de una espera activa.

```python
# Frágil: depende del reloj del servidor
def test_token_expiry():
    token = issue_token(ttl=60)
    assert is_expired(token)   # pasa a veces, según dónde cae el segundo

# Robusto: controla el tiempo
def test_token_expiry(frozen_time):
    frozen_time.set("2026-11-20 12:00:00")
    token = issue_token(ttl=60)
    frozen_time.advance("61s")
    assert is_expired(token)
```

El patrón `sleep` es el clásico, y conviene mirar con suspicacia cada `time.sleep()` en un test:

```python
# Frágil: 200ms puede no ser suficiente bajo carga
def test_eventual_consistency():
    publish_event()
    time.sleep(0.2)
    assert read_event() is not None

# Robusto: espera activa con timeout
def test_eventual_consistency():
    publish_event()
    assert wait_until(lambda: read_event() is not None, timeout=5)
```

`wait_until` con timeout es más lento en el caso feliz, pero **nunca miente**. En testing, «nunca miente» gana siempre a «rápido a veces».

---

## 4. Cuándo un test rojo sí es buena noticia

No quiero que este post se lea como un argumento contra los tests. Al contrario: la tesis real es que **un test bien escrito es un activo valiosísimo, y un test mal mantenido es una carga que se arrastra**. Lo que voy a proponer es que el estado «rojo» debe ser **transitorio por diseño**, con una fecha de caducidad explícita.

Hay un caso donde el rojo es exactamente lo que quieres: **el test rojo primero de TDD**. En ese flujo, escribes un test que describe el comportamiento que quieres, lo ejecutas, y verificas que **falla por la razón correcta** (no por un error de sintaxis, ni por un `ImportError`, ni porque el fixture está roto).

```python
def test_sum_discounted_prices():
    assert Cart(items=[Price(100), Price(200)]).total(with_discount=0.1) == 270
```

Si esto pasa a la primera, tu test no está probando nada: está probando que ya existía. La práctica de verificar que el test falla *y que falla por la razón que esperabas* es lo que convierte el rojo en información en lugar de en ruido.

La diferencia con el rojo crónico es fundamental:

| | Rojo de TDD | Rojo crónico |
|---|---|---|
| Duración | Minutos | Semanas o meses |
| Dueño | Quien lo escribió | Nadie |
| Documentación | El PR lo explica | Un comentario en el código |
| Vencimiento | Inmediato | Indefinido |
| Valor | Descubre el bug | Enseña a ignorar |

El rojo de TDD es un **antibiótico**: se administra, tiene duración corta y se elimina. El rojo crónico es una **infección**: se extiende y no se trata.

Regla operativa:

> Un rojo debe estar en el repositorio **menos tiempo del que tarda en discoverirse que no era un bug real**.

---

## 5. El protocolo: cómo se evita llegar al rojo crónico

### 5.1 Regla del «no me lo llevo a casa»

Si un test falla y no vas a arreglarlo en esta sesión, no lo fusionas. O lo arreglas, o lo marcas como `xfail` **con una razón y un issue de seguimiento**, o lo eliminas. No existe la categoría intermedia de «rojo que vive en `main` y que ya nadie recuerda por qué».

En Python, `xfail` es la herramienta correcta y es mucho mejor que `skip`, porque **sigue ejecutándose** y sigue informando si, al desaparecer el bug, el test pasa (lo que activa un `xfail(strict=True)` — el propio framework te avisa de que ya puedes arreglar el test y quitar la marca).

```python
@pytest.mark.xfail(
    reason="Issue #482 — el motor de descuentos no maneja cupones apilables",
    strict=True,
)
def test_stacked_coupons():
    assert Cart(items=[Price(100)]).apply(Coupon("A10"), Coupon("B20")) == 70
```

`strict=True` es el detalle que importa: cuando el bug se arregle, el test fallará y te dirá que es hora de limpiar la marca. Sin `strict`, un `xfail` que empieza a pasar es **silencioso**: nadie se entera de que el bug ya está arreglado y el test lleva meses sin verificar nada.

### 5.2 Presupuesto de rojo

Un equipo puede fijar un presupuesto explícito: **cero rojez en `main`, y máximo N minutos de rojez en una rama**. Si el CI está rojo durante más de X minutos, alguien es responsable de arreglarlo o de revertir. Esto es exactamente lo que hacen los equipos de infraestructura con los *error budgets* en SRE, y funciona por la misma razón: hace el coste de la rojez **visible y finito**.

### 5.3 Tests como puerta, no como aspiradora

El patrón correcto para un test que detecta un bug real pero cuyo fix es grande es **escribir el test en la rama del fix, no en `main`**. El test rojo vive en la rama, viaja con el arreglo, y llega a `main` verde. En la práctica esto significa: *test y fix son la misma unidad de trabajo*.

### 5.4 Higiene de la suite

- **Sin `sleep`** en tests. Usa esperas activas con timeout.
- **Sin tests que dependan del orden de ejecución.** Cada test debe poder correr solo, en cualquier orden, en cualquier máquina.
- **Sin `skip` silenciosos.** Si se usa `skip`, la razón debe explicar por qué el comportamiento esperado *no es* el correcto hoy.
- **Revisión de la suite con presupuesto.** Una suite que tarda 40 minutos en correr se deja de ejecutar, y una suite que no se ejecuta es una suite roja con esteroides. Divide los tests en suites por velocidad: `fast` (obligatorio en pre-commit, < 2 min) y `slow` (obligatorio en CI, puede tardar). Si la suite `fast` tarda 40 minutos, nadie la ejecuta en local y tu bucle de feedback se convierte en una ida y vuelta al CI de 30 minutos.

### 5.5 La métrica que de verdad importa

No midas «cobertura de líneas». Mide **el tiempo entre la introducción de un defecto y su detección**. Esa métrica es la que conecta directamente los tests con el valor de negocio, y es la única que responde a la pregunta que importa: *¿cuánto tiempo vivo con un bug desconocido?*

Métricas secundarias útiles:

- **Ratio de rojez por rama**: qué porcentaje del tiempo está un test en rojo. Debe acercarse a cero.
- **Edad de los `xfail`/`skip`**: un `xfail` con más de 30 días es un bug disfrazado de decisión.
- **Flakiness rate**: proporción de fallos no reproducibles por run. Cualquier valor mayor que cero que no se esté reduciendo es una alerta.

---

## 6. La inversión: de rojo crónico a rojo transitorio

Si estás en el estado de «suite crónicamente roja», la transición no se hace con un fix heroico. Se hace por fases:

**Fase 1 — Congelar.** Congela el rojo: no se arregla nada nuevo hasta que la suite esté verde. Añade PRs solo si arreglan o matan tests. Nada de añadir features a una base de código que no sabes si está roto.

**Fase 2 — Triaje.** Clasifica cada rojo en: (a) bug real de producto, (b) test mal escrito, (c) causa ambiental (red, tiempo, recursos), (d) bug ya arreglado pero el test no se actualizó. Las categorías (b), (c) y (d) son baratas: son de minutos.

**Fase 3 — Congelar el comportamiento.** Para cada bug real de producto que no puedas arreglar todavía, escribe el `xfail` con `strict=True`, con issue y con fecha. Esto no arregla el bug, pero **restaura la honestidad de la suite**: ahora el rojo es visible, acotado y con dueño.

**Fase 4 — Presupuesto de deuda.** Decide explícitamente qué bugs de la categoría (a) se arreglan este trimestre y con qué criterio. Los que no, se marcan con `xfail(strict=True)` y se revisan mensualmente.

El resultado no es «una suite sin bugs». Es algo mucho más valioso: **una suite en la que cada rojo significa algo**. Y esa es la diferencia entre una infraestructura de testing y un adorno.

---

## 7. La tesis

El valor de un test no está en pasar. Está en **ser creíble**. Un test que pasa te da información: el comportamiento sigue vigente. Un test que falla te da información: algo cambió. Un test que falla desde hace seis meses no te da información: te da **ruido con forma de información**, y el ruido con forma de información es lo más peligroso que puede tener una herramienta de verificación, porque **desactiva el único mecanismo de alarma que tienes**.

La buena noticia es que la solución es simétrica al problema:

- Si un test falla, arréglalo o mátalo. No lo dejes sangrar en `main`.
- Si un test no se puede arreglar, márcalo con `xfail(strict=True)` y con issue. Que sea una **deuda visible**, no un hecho consumado.
- Si un test es flaky, trátalo como un bug de prioridad alta, no como una molestia.
- Si la suite tarda una eternidad en correr, divídela. Un test que no se ejecuta no verifica nada.

La frase que empieza este post debería reformularse así:

> **Prefiero un test que falla y que alguien arregla esta semana a no tener tests. Y prefiero un test que muere a un test que miente durante seis meses.**

Un test que muere te cuesta un fin de semana. Un test que miente te cuesta un incidente de producción, un cliente que no vuelve, y un equipo que ha decidido que los tests son un trámite.

El objetivo nunca fue «ver verde». El objetivo era **poder confiar en el rojo**. Cuando un test falla, alguien tiene que mirar. Y para que eso sea verdad —y no una fantasía— cada rojo debe ser raro, estar justificado y tener fecha de caducidad.

---

*Nota: la idea central es simple: la suite de tests es un sensor. Un sensor que se calibra mal es peor que un sensor ausente, porque no solo te deja sin información: te deja **creyendo** que tienes información.*
