He escrito el post del blog y lo he guardado en `por-que-los-flaky-tests-son-peores-que-no-tener-tests.md`.

### Resumen del contenido
- **La ilusión de la red de seguridad:** por qué trabajar sin tests hace explícito el riesgo, mientras que los *flaky tests* generan falsa confianza y ruido.
- **Impacto en el equipo y el producto:** pérdida de confianza (*Pedro y el lobo*), coste por cambios de contexto y reintentos en CI, y bugs reales de concurrencia ocultos tras el botón de *re-run*.
- **Causas habituales:** esperas fijas (`sleep`), dependencia del reloj/zona horaria, estado compartido y dependencias externas sin aislar.
- **Plan de acción práctico:** tolerancia cero en la rama principal, cuarentena o eliminación temporal, registro de reintentos y reproducción bajo carga/estrés local.
