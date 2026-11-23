# Cuando el rojo pierde credibilidad

El lunes falló el test de facturación. Alguien volvió a lanzar la integración continua, la segunda ejecución salió verde y el equipo siguió trabajando. El jueves volvió a fallar el mismo test. Esta vez un cambio en el cálculo del IVA sí había roto la factura. Para cuando alguien abrió el mensaje de error, dos personas ya habían pulsado «Reintentar».

Sin ese test, el equipo tendría un hueco de cobertura. Con un test que falla de forma intermitente, tiene además un hábito aprendido que puede ocultar una regresión. El daño empieza cuando ignorar el rojo se convierte en una forma razonable de terminar el trabajo.

## Medio segundo en una máquina ocupada

Imagina una prueba que comprueba si un cliente recibe su factura por correo. La aplicación encola el envío y un proceso en segundo plano se encarga de entregarlo. La parte decisiva del test ocupa tres líneas de Python.

```python
solicitar_factura(pedido)
time.sleep(0.5)
assert buzon.contiene_factura(pedido.id)
```

En el portátil de quien escribió el test, el correo suele llegar en veinte milisegundos. En una máquina de integración ocupada, el proceso puede tardar setecientos. En ese caso, la aserción falla aunque la factura llegue correctamente un instante después. El test ha introducido un requisito de medio segundo que nadie le pidió al producto.

Subir la pausa a dos segundos parece un arreglo barato. También obliga a esperar dos segundos cuando el mensaje ya estaba disponible a los veinte milisegundos. El día que la cola tarde tres segundos, tocará discutir otra vez cuánto tiempo dormir.

Si queremos comprobar el envío de extremo a extremo, podemos esperar a que aparezca **la factura de ese pedido** en el buzón de prueba, con un límite explícito. Así la prueba termina en cuanto observa el resultado. Si vence el plazo, conviene registrar si el trabajo quedó en cola, si el proceso lo recogió y si el buzón recibió algo. Si entregar en medio segundo fuera un compromiso real del producto, una entrega a los setecientos milisegundos sería precisamente el fallo que querríamos investigar.

## El coste lo paga también quien cambió un icono

Cuando ese test bloquea un cambio de interfaz, su autor tiene que dejar lo que estaba haciendo y averiguar si acaba de romper facturación. Al tercer susto, relanzar toda la suite cuesta menos esfuerzo que leer el informe. Esa decisión tiene sentido para quien quiere entregar su cambio. Repetida por todo el equipo, hace que incluso los fallos legítimos tarden más en investigarse.

El verde del reintento solo demuestra que una ejecución pasó. También una condición de carrera en producción puede desaparecer al segundo intento. Por eso merece la pena conservar el primer fallo. Saber que el correo llegó dos décimas después de la aserción orienta la investigación de un modo muy distinto a descubrir que el trabajo nunca entró en la cola.

## Qué hacer con el próximo rojo

Antes de pulsar «Reintentar», abre el fallo y formula la promesa que pretendía comprobar el test. En este caso podría ser «el cliente recibe una factura correspondiente a su pedido». Esa frase ayuda a decidir qué observar, qué datos aislar para cada ejecución y qué información guardar cuando se agota la espera.

Si la prueba bloquea entregas mientras se investiga, se puede apartar temporalmente del conjunto obligatorio y mantenerla en ejecución con sus fallos visibles. Conviene asignar a alguien la reparación y acordar cuándo se revisará. Así el equipo sabe qué cobertura le falta.

La próxima vez que falle facturación, quien cambió el icono debería poder abrir el informe y tomar una decisión fundada. Recuperar esa confianza vale bastante más que conseguir un verde a la segunda.
