# Cuando un test que falla a veces es peor que no tenerlo

Abres una pull request que solo cambia el texto de un botón. La integración continua (CI) falla en un test de la cola de correos. Alguien comenta «ese falla a veces» y relanza el job. Esta vez pasa. Apruebas el cambio y sigues con tu día.

Dos semanas después, ese mismo test vuelve a fallar. Esta vez, un cambio en el código hace que algunos correos se pierdan. El equipo ya tiene una respuesta ensayada para ese fallo. Vuelve a pulsar «Reintentar».

## El coste de un rojo que hemos aprendido a ignorar

Cuando falta un test, el pipeline se queda callado ante un fallo en esa parte del sistema. Un test intermitente puede causar un daño adicional. Cada alarma que el equipo descarta hace más fácil descartar la siguiente, incluso cuando apunta a una regresión real.

También hay un coste en cada ejecución. Alguien abre los logs, comprueba si el error le suena, relanza el job y vuelve a esperar. Si eso ocurre varias veces a la semana, revisar fallos acaba compitiendo con el trabajo que la CI debía agilizar. Y si la respuesta habitual es ejecutar hasta que todo salga en verde, el estado del pipeline empieza a depender de cuántos intentos hizo quien abrió la pull request.

Que un test pase al segundo intento solo demuestra que el fallo no se reprodujo en esa ejecución. Una carrera entre dos hilos puede depender del orden en que se ejecuten. Ese orden puede cambiar entre dos intentos con el mismo código.

## Un ejemplo con una cola de correos

Imagina un test que encola un correo, espera 100 milisegundos y comprueba que el worker lo registró como enviado. En tu portátil suele sobrar tiempo. En un runner ocupado, el worker puede empezar después de que el test ya haya hecho la comprobación. Subir la espera a un segundo reduce la probabilidad de fallo a cambio de hacer más lento cada intento.

Si lo que quieres comprobar es que el worker registra el envío, haz que un doble de prueba avise cuando se haya registrado y espera esa señal con un plazo máximo. El test continúa en cuanto llega la señal. Si vence el plazo, el error puede incluir el identificador del trabajo y el último estado observado. Si los 100 milisegundos son un requisito de rendimiento del producto, esa comprobación merece una medición propia en condiciones controladas.

Esa misma investigación puede revelar que el worker termina sin registrar el envío bajo ciertas condiciones. En ese caso, el fallo intermitente acaba de señalar un bug del producto. Conviene conservar la evidencia del primer intento, como los logs, la semilla aleatoria o el orden de ejecución, según lo que pueda afectar al resultado.

## Qué hacer con el test mientras se investiga

Empieza por mirar cómo falla. Si pasa aislado y falla en la suite, busca estado compartido entre tests. Si las fechas cambian el resultado, controla el reloj. Si depende de un trabajo en segundo plano, sincroniza el test con el evento que necesita observar.

Si el test bloquea cambios a diario y el arreglo lleva tiempo, puedes sacarlo temporalmente del conjunto que bloquea los merges y seguir ejecutándolo con sus resultados visibles. Dale una persona responsable y una fecha de revisión. Si cubre un flujo crítico, confirma qué cobertura queda antes de quitar ese bloqueo.

En la próxima pull request, un fallo debería dar a quien revisa el cambio algo que investigar. Si el único dato que conserva el equipo es que al final salió en verde, también ha perdido la pista que podía llevarlo al bug.
