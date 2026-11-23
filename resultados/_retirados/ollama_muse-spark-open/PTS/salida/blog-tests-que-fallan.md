# Por qué los tests que fallan a veces son peores que no tener tests

Tener tests que fallan constantemente y nadie arregla genera una falsa sensación de seguridad peor que no tener tests. Si no tienes tests, sabes que estás desprotegido. Si tienes tests rojos que ignoras, crees que estás cubierto cuando no lo estás.

## 1. Normalizan el fallo

Cuando `npm test` siempre muestra 3 tests en rojo, el equipo aprende a ignorar la salida. El día que falla un test crítico de verdad, nadie lo nota porque el rojo ya es "normal".

Es el efecto de la alarma del coche que suena toda la noche: al final nadie mira por la ventana.

```bash
# Esto deja de significar algo:
Tests: 3 failed, 47 passed
# ¿Son los 3 de siempre o hay uno nuevo?
```

## 2. Ralentizan el desarrollo

Un test flaky o roto obliga a:

* Re-ejecutar la suite varias veces "a ver si pasa"
* Añadir `skip` o `.todo` para poder mergear
* Perder 20 minutos debugeando un fallo que no es tu culpa

Ese tiempo es más caro que no tener el test. Al menos sin test haces deploy rápido (y asumes el riesgo).

## 3. Destruyen la confianza en la suite

La utilidad de los tests es la confianza para refactorizar. Si no confías en ellos, no refactorizas. Si no refactorizas, el código se pudre.

Un test suite en el que no confías es deuda técnica con esteroides: pagas el coste de mantenerlo sin obtener el beneficio.

## 4. Esconden bugs reales

El peor caso: un test falla por una mala aserción, lo marcas como `skip`, y dos meses después ese módulo introduce un bug crítico en producción. El test lo habría atrapado si hubiera estado verde y activo.

Silenciar un test es como quitar la pila al detector de humo porque pita cuando cocinas.

## ¿Qué hacer entonces?

1.  **Tolerancia cero al rojo en main.** Si falla, se arregla o se borra antes de mergear. `main` siempre verde.
2.  **Borrar es mejor que silenciar.** Un test borrado es honesto: sabes que falta cobertura. Un test en `skip` es mentiroso.
3.  **Tests deterministas o nada.** Si depende de `sleep(100)`, de una API externa o del orden de ejecución, arréglalo o elimínalo.
4.  **Cuarentena con fecha de caducidad.** Si un test es flaky, muévelo a cuarentena y crea un ticket con dueño y fecha. Si no se arregla en una semana, se borra.

## Conclusión

No tener tests es un riesgo visible. Tener tests rojos que todos ignoran es un riesgo invisible.

Y en ingeniería, el riesgo invisible siempre es más caro.

100 tests verdes y confiables valen más que 500 de los cuales 20 fallan "a veces".
