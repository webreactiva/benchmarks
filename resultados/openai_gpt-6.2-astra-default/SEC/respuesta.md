Revisaré el código, la configuración y las dependencias disponibles. Guardaré el informe en la carpeta actual, con la evidencia y las correcciones propuestas para cada hallazgo.

---

El registro público permite elegir el rol de la cuenta. También encontré consultas SQL que incorporan texto de la petición y una ruta de archivos sin control de acceso. El informe distinguirá qué fallos son accesibles sin sesión y cuáles requieren permisos o condiciones de despliegue.

---

La auditoría identifica **14 hallazgos: 3 críticos, 9 altos y 2 medios**. Recomiendo posponer la exposición pública del proyecto. El registro permite crear cuentas administrativas, la recuperación de contraseña usa tokens predecibles y la versión de Next.js fijada está afectada por una vulnerabilidad de ejecución remota de código.

Guardé el [informe de auditoría](./AUDITORIA_SEGURIDAD.md) en la carpeta actual. Incluye la evidencia en el código, el orden de corrección y los criterios para verificar cada arreglo.

La revisión fue estática. La exposición efectiva en producción y la posible existencia de accesos indebidos quedan sin verificar.
