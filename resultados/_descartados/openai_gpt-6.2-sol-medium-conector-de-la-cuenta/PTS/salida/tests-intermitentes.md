# Por qué un test que falla a veces puede ser peor que no tenerlo

El CI marca en rojo tu pull request. Abres el log y alguien del equipo reconoce el fallo: «Ese test falla a veces. Dale a reintentar». Lo haces, sale verde y se aprueba el cambio. La próxima vez, quizá el mismo test esté avisando de una regresión real. El equipo ya tiene una respuesta aprendida.

Un test intermitente, o *flaky test*, puede pasar o fallar con la misma versión del código. Basta con que cambie el orden de ejecución, la carga de la máquina o la hora. Su coste más serio aparece cuando el equipo deja de investigar los fallos que ese test señala.

## El coste de acostumbrarse al rojo

Sin un test, hay un hueco de cobertura. Con un test intermitente que bloquea el CI, hay además una decisión que tomar cada vez que falla. Alguien abre el log, espera otra ejecución y decide si el primer resultado merecía atención. Si casi siempre acaba pulsando «reintentar», el proceso de revisión termina premiando que alguna ejecución salga verde.

Imagina un test que comprueba que un pedido solo se cobra una vez. Durante semanas ha fallado esporádicamente por una condición de carrera. Si un cambio hace más probable el doble cobro, el siguiente fallo se parece a todos los anteriores. Un reintento que pasa solo demuestra que en esa ejecución no se observó el doble cobro. El primer fallo sigue siendo información sobre cómo se comporta el sistema.

## Un minuto que dura lo que tarda el CI

Supongamos que una sesión caduca exactamente al cumplirse un minuto. Este test intenta comprobar que sigue activa justo antes del límite:

```python
from datetime import datetime, timedelta, timezone


def sesion_activa(creada_en, ahora):
    return ahora < creada_en + timedelta(minutes=1)


def test_sesion_activa_justo_antes_de_caducar():
    creada_en = datetime.now(timezone.utc) - timedelta(seconds=59.99)
    assert sesion_activa(creada_en, datetime.now(timezone.utc))
```

Entre las dos lecturas del reloj hay un margen de diez milisegundos. Si el proceso queda en pausa el tiempo suficiente, la sesión habrá caducado cuando se ejecute la aserción. La función se comporta tal como se diseñó y el test falla.

La función ya acepta la hora como argumento. Podemos pasarle dos instantes fijos y aprovechar para comprobar el límite exacto:

```python
def test_sesion_activa_justo_antes_de_caducar():
    creada_en = datetime(2025, 1, 1, tzinfo=timezone.utc)
    justo_antes = creada_en + timedelta(seconds=59, milliseconds=999)

    assert sesion_activa(creada_en, justo_antes)


def test_sesion_caduca_al_cumplirse_un_minuto():
    creada_en = datetime(2025, 1, 1, tzinfo=timezone.utc)
    al_caducar = creada_en + timedelta(minutes=1)

    assert not sesion_activa(creada_en, al_caducar)
```

Ahora ambos casos conservan su significado aunque el ejecutor se quede en pausa entre una línea y la siguiente.

## Qué hacer cuando aparece un fallo intermitente

1. **Conserva el primer fallo.** Guarda el log y los datos que ayuden a reproducirlo, como la semilla, el orden de los tests o la configuración del ejecutor. Usa el reintento para reunir más información.
2. **Localiza de dónde viene la variación.** Para el reloj, fija los instantes. Si hay estado compartido, aísla los datos de cada test. Si la aserción se adelanta a una tarea asíncrona, espera una señal observable de que terminó. Si lo que varía es un comportamiento incorrecto del producto, corrige el producto.
3. **Pon fecha a la cuarentena.** Si el fallo bloquea al equipo y no puedes resolverlo enseguida, saca temporalmente el test del control obligatorio. Mantenlo ejecutándose en un job visible y asigna a alguien la investigación con una fecha de revisión. Si confirma un defecto grave, conserva el bloqueo hasta resolverlo.

Una suite se gana la confianza en el momento en que falla. Si el equipo puede abrir el log y tomar en serio lo que ve, ese rojo le está ahorrando una investigación más tarde, cuando el fallo ya le ha llegado a un usuario.
