# Por qué un test que falla a veces es peor que no tener tests

Todos hemos vivido esta escena. El pipeline de CI se pone en rojo. Abres el log, ves que ha fallado un test que no tiene nada que ver con tu cambio, pulsas «Re-run» y, magia, se pone en verde. Te encoges de hombros, haces merge y sigues con tu vida.

Ese encogimiento de hombros es el síntoma de una enfermedad grave. Y defiendo una tesis que suena exagerada pero que creo cierta: **un test intermitente (*flaky*) es peor que no tener ningún test.**

## Un test sin test es honesto

Si no tienes un test para una parte del código, sabes que no tienes red de seguridad ahí. Eres consciente del riesgo, lo compensas con más cuidado, con revisión manual o con una prueba exploratoria antes de desplegar.

Un test intermitente, en cambio, **miente**. Aparenta ofrecer una garantía que no ofrece. Y lo hace de la peor manera posible: no siempre. Cuando está en verde, no sabes si es porque el código es correcto o porque has tenido suerte. Cuando está en rojo, no sabes si hay un bug o si es «el de siempre».

Un test solo tiene valor si su resultado **te hace cambiar de decisión**. Si pasa o falla con independencia de la calidad del código, su información es cero. Y encima tiene coste.

## Los costes reales

### 1. Erosiona la confianza en toda la suite

La confianza no se pierde test a test, se pierde de golpe. Cuando el equipo aprende que «el CI a veces falla sin motivo», empieza a tratar *todos* los fallos como ruido. Es la fábula del pastor y el lobo en versión DevOps: el día que un test falle por un bug real, alguien dirá «seguro que es otro flaky» y pulsará re-run.

Así es como los bugs reales llegan a producción teniendo una suite con cobertura del 90 %.

### 2. Cuesta tiempo, mucho tiempo

Haz la cuenta. Un test que falla el 2 % de las veces parece inofensivo. Pero si tu suite tiene 500 tests con esa tasa de fallo independiente, la probabilidad de que el pipeline pase limpio es:

```
0.98 ^ 500 ≈ 0.00004 %
```

Prácticamente nunca. En la práctica, con unos pocos tests flaky, el CI falla constantemente y cada ejecución requiere reintentos. Multiplica por el número de desarrolladores, por el tiempo de espera de cada pipeline, por el cambio de contexto mientras esperas. Es una sangría silenciosa de productividad.

### 3. Normaliza los reintentos automáticos

La «solución» más popular es configurar el CI para que reintente los tests fallidos hasta tres veces. Es el equivalente a tapar el piloto del salpicadero con cinta aislante. Los reintentos no arreglan nada: esconden el problema, alargan los pipelines y, peor aún, pueden ocultar **bugs reales de concurrencia** que solo aparecen de vez en cuando… que es exactamente lo que está intentando decirte ese test.

### 4. Desmoraliza al equipo

Nadie entra en una profesión técnica para pulsar «Re-run» veinte veces al día. Una suite poco fiable genera cinismo: «los tests no sirven para nada». Y esa conclusión, que empieza siendo cierta para unos pocos tests, se generaliza a todos y acaba con la cultura de testing del equipo.

## ¿De dónde viene la intermitencia?

Casi siempre hay un no determinismo que nadie ha controlado. Los sospechosos habituales:

- **Tiempo y esperas**: `sleep(2)` «para dar tiempo a que termine», o aserciones que dependen de que algo ocurra en menos de X milisegundos. En un portátil funciona; en un runner de CI saturado, no.
- **Orden de ejecución y estado compartido**: tests que dependen de datos que dejó otro test, de una base de datos sin limpiar, de variables globales o *singletons*.
- **Concurrencia**: *race conditions*, hilos, tareas asíncronas que no se esperan correctamente.
- **Dependencias externas**: llamadas reales a APIs, servicios de terceros, la red, el DNS.
- **Datos no deterministas**: fechas (`now()`), zonas horarias, números aleatorios sin semilla, orden no garantizado de elementos en un `Set` o en un resultado SQL sin `ORDER BY`.
- **Entorno**: puertos ocupados, ficheros temporales, diferencias entre máquinas.

Un ejemplo clásico:

```python
def test_pedido_se_procesa():
    pedido = crear_pedido()
    cola.enviar(pedido)
    time.sleep(1)  # ¡rezando!
    assert pedido.estado == "PROCESADO"
```

Este test no verifica que el pedido se procese; verifica que se procese *en menos de un segundo en la máquina que toque*. Compáralo con esperar de forma explícita a una condición, con un límite razonable:

```python
def test_pedido_se_procesa():
    pedido = crear_pedido()
    cola.enviar(pedido)
    esperar_hasta(lambda: pedido.estado == "PROCESADO", timeout=10)
```

O, mejor aún, hacer que el código bajo test sea síncrono en el entorno de pruebas inyectando una cola en memoria.

## Qué hacer: una política de tolerancia cero (razonable)

1. **Mide.** No puedes arreglar lo que no ves. Guarda el histórico de resultados de CI y calcula la tasa de fallo por test. Muchas plataformas ya ofrecen informes de *flakiness*; si no, un script sencillo basta.
2. **Pon en cuarentena, no en el limbo.** Si un test es intermitente, sácalo del camino crítico (márcalo y ejecútalo en un job aparte que no bloquee el merge) y **abre un ticket con responsable y fecha**. La cuarentena sin seguimiento es solo un borrado con pasos extra.
3. **Arregla la causa, no el síntoma.** Resiste la tentación del `retry` y del `sleep` más largo. Busca el no determinismo y elimínalo: relojes inyectables, semillas fijas, aislamiento de datos por test, dobles de prueba para lo externo.
4. **Si no puedes arreglarlo, bórralo.** Sí, borrarlo. Un test que no se puede hacer fiable no aporta información y sí cuesta. Es mejor reconocer un hueco de cobertura que fingir que no existe.
5. **Reproduce a propósito.** Ejecuta el test en bucle (`pytest --count=500`, `go test -count=500 -race`, etc.), en paralelo, con orden aleatorio y bajo carga de CPU. Lo que falla una vez de cada cincuenta falla enseguida cuando lo sometes a presión.
6. **Cultura.** Que un fallo intermitente se trate como un bug de primera categoría. El que lo ve, lo reporta; el equipo lo prioriza. «Es el de siempre» debería ser una frase prohibida.

## Una matización honesta

No estoy diciendo que los tests intermitentes sean *inútiles* en todos los casos. A veces un test flaky es la única señal de un bug de concurrencia real, y entonces es un tesoro: el bug está en producción, solo que todavía no te ha mordido. La diferencia está en qué haces con él. Si lo investigas, ganas. Si lo ignoras con un reintento, pierdes dos veces: la señal y la confianza.

## Conclusión

Un test es un contrato: «si esto está en verde, puedes seguir; si está en rojo, para». Un test intermitente rompe ese contrato en ambas direcciones. No te protege, te hace perder tiempo y entrena a tu equipo para ignorar las alarmas.

Prefiero mil veces una suite pequeña, rápida y fiable a una enorme en la que «a veces falla». Porque con la primera sé exactamente lo que tengo, y con la segunda solo tengo una falsa sensación de seguridad.

La próxima vez que tengas la tentación de pulsar «Re-run» y seguir adelante, recuerda: ese rojo estaba intentando decirte algo. Escúchalo, o apágalo, pero no lo ignores.

---

*¿Cuál es el test flaky más absurdo con el que te has encontrado? Cuéntalo en los comentarios.*
