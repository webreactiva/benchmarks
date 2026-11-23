He escrito el artículo y lo he guardado en `por-que-los-tests-flaky-son-peores-que-no-tener-tests.md`.

El post cubre:
- **El problema de la confianza:** por qué el ruido disfrazado de señal (el reflejo de pulsar *Re-run*) erosiona la utilidad de toda la suite.
- **El coste oculto:** impacto en el tiempo de CI, cambios de contexto, degradación cultural y ocultación de bugs reales de concurrencia.
- **Causas habituales:** dependencia del tiempo, estado compartido, asincronía mal sincronizada, dependencias externas y aleatoriedad sin semilla (con un ejemplo práctico en código).
- **Soluciones prácticas:** cuarentena/eliminación de tests inestables, uso responsable de `retries`, pruebas repetidas antes del *merge* y diseño determinista.
