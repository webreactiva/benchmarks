# Por qué los tests que fallan a veces son peores que no tener tests

Son las cuatro de la tarde de un viernes. Acabas de subir un cambio de tres líneas para corregir un texto en la interfaz. Abres el Pull Request, esperas diez minutos a que termine el pipeline de integración continua y aparece la temida cruz roja:

`FAIL src/checkout/payment.spec.ts — Expected 200, received 504`

Nadie se alarma. Un compañero comenta en el PR: *"Ah, ese test lleva semanas tonto. Dale a re-run"*. Pulsas el botón de reintentar, el pipeline se pone en verde al segundo intento y haces *merge* sin mirar atrás.

Esa escena, tan cotidiana en cientos de equipos de desarrollo, esconde una verdad incómoda: **un test que falla a veces (*flaky test*) no es una red de seguridad con algún agujero; es una trampa activa que hace más daño que no tener ningún test.**

---

## La diferencia entre la incertidumbre honesta y una señal mentirosa

No tener tests es un problema conocido, pero al menos es **honesto**. Cuando un módulo carece de pruebas automatizadas, todo el equipo lo sabe y actúa en consecuencia: las revisiones de código son más minuciosas, los despliegues se hacen con cautela y nadie asume que "si compila, funciona". Sabes que caminas sin red y miras dónde pisas.

Una suite plagada de tests intermitentes hace justo lo contrario: proyecta la **ilusión de seguridad** mientras destruye silenciosamente el valor de toda la batería de pruebas.

El propósito fundamental de un test automatizado no es comprobar que el código funciona; es ofrecer una **señal determinista** en la que puedas confiar para tomar decisiones rápidas. En el momento en que un mismo *commit*, sin tocar ni una sola línea de código, puede dar rojo a las 16:00 y verde a las 16:05, la señal deja de ser información y se convierte en ruido.

---

## El efecto «Pedro y el lobo» en tu CI

El mayor peligro de los tests inestables no es el tiempo que pierdes reintentando pipelines, sino el **entrenamiento psicológico** al que someten al equipo.

Cuando un pipeline falla diez veces por semana sin que exista un error real, el cerebro humano optimiza el esfuerzo: deja de investigar la causa y pasa directamente a pulsar *Re-run failed jobs*. Se institucionaliza el reflejo de ignorar las alertas.

Y entonces llega el día en que sí hay un bug real:
- Una condición de carrera sutil en producción.
- Una fuga de conexiones a la base de datos bajo carga.
- Un problema real de concurrencia que solo ocurre el 10 % de las veces.

El test detecta exactamente el fallo para el que fue creado. Se pone en rojo. El desarrollador pulsa *Re-run*, en la siguiente ejecución la condición de carrera no se reproduce, el pipeline pasa a verde y **el bug llega a producción con el sello de aprobación del CI**.

Sin tests, habrías tenido precaución. Con un test intermitente, tuviste permiso para ignorar la evidencia.

---

## El coste oculto que nadie apunta en Jira

Más allá del riesgo en producción, convivir con tests erráticos impone un impuesto diario a la velocidad del equipo:

1. **Cambio de contexto constante:** Subes tu código, pasas a otra tarea y veinte minutos después una notificación te obliga a volver para revisar si el fallo es culpa tuya o "el test de siempre".
2. **Atascos en las colas de *merge*:** Si utilizas *merge queues* y tienes tres tests que fallan un 5 % de las veces de forma independiente, aproximadamente **uno de cada siete intentos de integración fallará sin motivo**, reiniciando colas enteras y bloqueando a todo el equipo.
3. **La teoría de las ventanas rotas:** Cuando se normaliza que haya tests caprichosos, la exigencia técnica cae en picado. Primero se reintenta el pipeline; luego se añade `retry: 3` a toda la suite; más tarde empiezan a proliferar los `test.skip` que nadie vuelve a activar.

---

## Anatomía del culpable habitual

Casi ningún test falla "por magia". Detrás de la intermitencia suele haber acoplamiento al entorno, al reloj del sistema o al orden de ejecución. Veamos un clásico engañosamente inocente:

```ts
// ❌ Test frágil: depende del reloj real y de tiempos arbitrarios
test("expira el token después de 100ms", async () => {
  const token = createShortLivedToken({ ttlMs: 100 });

  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(isValid(token)).toBe(false);
});
```

En tu portátil de última generación pasa siempre. En un contenedor compartido de CI con la CPU saturada, el *event loop* o el reloj pueden comportarse con milisegundos de diferencia, o al revés: una operación previa tarda de más y otro test asume que el token aún sigue vivo.

La versión determinista elimina el factor azar controlando explícitamente el tiempo (o inyectando un reloj):

```ts
// ✅ Test determinista: el tiempo es un dato controlado, no una espera real
test("expira el token cuando supera su TTL", () => {
  let now = 1_000_000;
  const clock = () => now;

  const token = createShortLivedToken({ ttlMs: 100, clock });
  expect(isValid(token, { clock })).toBe(true);

  now += 101;
  expect(isValid(token, { clock })).toBe(false);
});
```

Los otros sospechosos habituales siguen el mismo patrón:
- **`sleep()` en tests end-to-end** en lugar de esperar a una condición observable del DOM o de la red.
- **Estado compartido** en bases de datos de prueba o variables globales cuando los tests corren en paralelo.
- **Datos aleatorios o fechas actuales (`new Date()`)** que fallan solo el día 29 de febrero, en cambios de hora o a medianoche UTC.
- **Dependencias de servicios externos reales** cuya latencia o disponibilidad no controlas.

---

## Tolerancia cero: repara, aísla o borra

Si tratas la suite de tests como código de segunda categoría, acabará comportándose como tal. Recuperar la confianza en el pipeline exige una regla simple pero estricta: **un test inestable en la rama principal es un bug de prioridad alta**.

Cuando aparezca uno, solo deberían existir tres opciones válidas:

1. **Arreglar la causa raíz de inmediato:** Eliminar la dependencia temporal, aislar el estado o hacer determinista la aserción. No pongas un `retry` como tirita permanente; los reintentos automáticos suelen ocultar condiciones de carrera reales de tu propia aplicación.
2. **Ponerlo en cuarentena con fecha de caducidad:** Si no puedes arreglarlo hoy, sácalo del pipeline bloqueante y muévelo a un *job* separado de cuarentena con un ticket asignado y una fecha límite clara.
3. **Borrarlo sin remordimientos:** Esta es la decisión que más cuesta tomar por la falacia del coste hundido. Si un test lleva meses fallando aleatoriamente, nadie entiende bien qué prueba y cada vez que falla todo el mundo lo ignora, **ese test ya no protege nada**. Borrarlo mejora instantáneamente la relación señal/ruido de tu proyecto.

---

## Conclusión

El valor de una suite de tests no se mide por el porcentaje de cobertura en una insignia del `README`, sino por la respuesta a una sola pregunta: **cuando un test falla, ¿el equipo asume que el código está roto o asume que el test está roto?**

Si la respuesta es la segunda, ese test ha dejado de ser un activo para convertirse en deuda técnica con intereses compuestos. A veces, la mejora de calidad más valiente que puedes hacer hoy en tu repositorio no es escribir diez tests nuevos, sino arreglar —o eliminar— ese test que "solo falla de vez en cuando".
