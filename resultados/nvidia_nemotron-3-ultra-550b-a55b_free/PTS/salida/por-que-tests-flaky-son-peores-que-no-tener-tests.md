# Por qué los tests flaky son peores que no tener tests

Los tests que fallan intermitentemente (flaky tests) son uno de los problemas más insidiosos en el desarrollo de software. A primera vista, tener *algunos* tests parece mejor que no tener ninguno. Pero la realidad es más compleja.

## El costo oculto de los tests flaky

### 1. Erosionan la confianza

Cuando un test falla aleatoriamente, el equipo deja de creer en la suite de tests. "Ah, ese test siempre falla, vuelve a correrlo" se convierte en la respuesta estándar. Esto anula el propósito principal de los tests: **dar confianza**.

### 2. Ocultan bugs reales

Si el 20% de tus tests fallan por razones ajenas al código, los desarrolladores ignoran las alertas. Un fallo real se pierde en el ruido. El resultado: bugs que llegan a producción.

### 3. Desperdician tiempo de desarrollo

Cada ejecución fallida requiere investigación manual. ¿Es un bug real? ¿Es el test? ¿Es el entorno? Ese tiempo no se recupera. Multiplicado por cada CI run, cada developer, cada día.

### 4. Frenan el refactoring

El miedo a romper tests flaky hace que los equipos eviten tocar código que "funciona". La deuda técnica se acumula porque nadie quiere lidiar con la incertidumbre.

### 5. Dan falsa seguridad

Un test flaky que *pasa* no garantiza nada. Puede estar pasando por casualidad. Es peor que no tener test porque **crees que estás cubierto cuando no lo estás**.

## ¿Qué hacer en su lugar?

1. **Bórralos o arréglalos ya**. No hay término medio. Un test flaky es deuda técnica con intereses compuestos.

2. **Aísla la causa**: timing, estado compartido, dependencias externas, datos de test sucios.

3. **Usa timeouts generosos** y reintentos *solo* como medida temporal mientras arreglas la causa raíz.

4. **Prioriza tests deterministas**: unit tests > integration tests > E2E tests para la suite rápida.

5. **Monitorea la flakiness**: si un test falla >1% de las veces sin cambios de código, es flaky.

## Conclusión

Una suite de tests pequeña, rápida y 100% confiable vale infinitamente más que una suite grande, lenta y flaky.

**Mejor cero tests que tests en los que no confías.**

---

*¿Has lidiado con tests flaky en tu equipo? Cuéntame tu experiencia en los comentarios.*