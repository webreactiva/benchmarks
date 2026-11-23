# Cuando un test intermitente es peor que no tener tests

El lunes falla un test de facturación. Pulsas «Reintentar» y pasa. El miércoles ocurre lo mismo. El viernes, justo después de cambiar cómo se redondea el IVA, vuelve a fallar. ¿Abrirías el informe o pulsarías «Reintentar»? Si ya tenías el dedo sobre el botón, los dos primeros fallos te han enseñado algo sobre el tercero. Quizá sea la lección equivocada.

Un test es intermitente cuando, sobre la misma revisión del código, unas ejecuciones pasan y otras fallan. Puede que la prueba dependa del reloj, del orden de ejecución o de un dato compartido. También puede que haya descubierto un defecto real que solo aparece de vez en cuando. El reintento en verde, por sí solo, deja abiertas ambas posibilidades.

## El coste de un falso aviso

Sin una prueba de redondeo, hay un hueco en la cobertura. Con una prueba que lleva semanas dando falsas alarmas, el equipo puede creer que ese hueco está cubierto y, al mismo tiempo, haber adquirido la costumbre de ignorar el único aviso que le serviría. Ahí es donde tener el test puede salir más caro que carecer de él.

Ese coste también lo paga quien toca otra parte del sistema. Si la facturación bloquea la integración de un cambio de estilos, alguien tiene que interrumpir su trabajo, leer el fallo y decidir si reintenta. Tras suficientes interrupciones, resulta tentador reejecutar toda la suite en cuanto aparece algo rojo. A partir de ahí, hasta una prueba fiable tiene que competir con la costumbre de darle una segunda oportunidad.

## Los últimos cien milisegundos del día

Imagina que una función devuelve la fecha de emisión de una factura en UTC. Este test de Python suele pasar:

```python
from datetime import datetime, timezone

def fecha_de_emision():
    return datetime.now(timezone.utc).date()

def test_fecha_de_emision():
    esperada = datetime.now(timezone.utc).date()
    assert fecha_de_emision() == esperada
```

Si la primera lectura ocurre a las 23:59:59,999 UTC y el proceso recupera la CPU pasada la medianoche, las dos fechas serán distintas. La función habrá devuelto la fecha correcta. Cuando abras el informe y repitas la prueba, ambas lecturas caerán ya en el día siguiente. Podrías pasar una mañana entera investigando un supuesto error de facturación.

La prueba puede elegir el instante. Por ejemplo, las 23:30 del 31 de enero en una zona con desfase de cinco horas al oeste de UTC ya son las 04:30 del 1 de febrero en UTC. Ese cruce de fecha nos da un caso interesante y un resultado que podemos escribir de antemano:

```python
from datetime import date, datetime, timedelta, timezone

def fecha_de_emision(instante=None):
    if instante is None:
        instante = datetime.now(timezone.utc)
    return instante.astimezone(timezone.utc).date()

def test_fecha_de_emision_usa_el_dia_en_utc():
    zona = timezone(timedelta(hours=-5))
    instante = datetime(2025, 1, 31, 23, 30, tzinfo=zona)
    assert fecha_de_emision(instante) == date(2025, 2, 1)
```

Quien emite una factura puede seguir llamando a la función sin argumentos. La prueba, en cambio, puede reproducir el cruce de medianoche a cualquier hora. Si mañana alguien simplifica la última línea a `return instante.date()`, el test fallará siempre y mostrará exactamente qué regla se ha perdido.

## Qué hacer con el próximo fallo

Antes de reintentar, conserva la primera ejecución. Una traza con los valores esperado y obtenido, la hora y, cuando proceda, la semilla aleatoria o el orden de los tests da un punto de partida para investigar. Si una prueba de cobros registra dos cargos cuando esperaba uno, merece la pena comprobar si producción permite ese mismo cruce de peticiones. Un fallo difícil de reproducir puede ser el aviso más valioso de la suite.

Si ya has confirmado que la inestabilidad está en la prueba y bloquea cambios ajenos, puedes sacarla temporalmente del grupo que decide si se permite integrar. Mantenla en ejecución, vincula sus fallos a una incidencia y asigna a alguien la reparación. Así, el próximo cambio de estilos podrá entrar y quien investigue seguirá recibiendo ejemplos del problema.

La próxima vez que un reintento salga verde, vuelve al primer informe. ¿Qué tendría que cambiar en el código, en los datos o en el entorno para producir aquellos dos resultados? Poder responder a esa pregunta es lo que hará que el siguiente aviso merezca tu atención.
