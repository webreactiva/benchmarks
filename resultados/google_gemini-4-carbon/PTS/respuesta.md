He escrito y guardado el artículo en `tests-que-fallan-a-veces.md` dentro de la carpeta actual.

### Qué incluye el post:
- **Gancho inicial:** El clásico escenario de viernes por la tarde pulsando *"Re-run jobs"* en CI hasta que el pipeline se pone en verde.
- **Tesis central:** Por qué la incertidumbre honesta (no tener tests y extremar la precaución) es menos peligrosa que una señal mentirosa que da falsa sensación de seguridad.
- **El efecto «Pedro y el lobo»:** Cómo los *flaky tests* entrenan al equipo para ignorar fallos reales de concurrencia o regresiones intermitentes.
- **Costes ocultos:** Cambios de contexto, bloqueos en *merge queues* y la teoría de las ventanas rotas (`retry`, `test.skip`).
- **Ejemplo práctico en código:** Comparativa entre un test frágil acoplado al reloj real (`setTimeout`) y su versión determinista inyectando el tiempo, junto con las causas más habituales de intermitencia.
- **Plan de acción:** Reparar la causa raíz, aislar en cuarentena con fecha de caducidad o borrar sin miedo a la falacia del coste hundido.
