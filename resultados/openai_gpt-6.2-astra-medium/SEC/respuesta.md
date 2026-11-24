Revisaré el código y la configuración del proyecto y guardaré en la carpeta actual un informe con los hallazgos, su impacto y las correcciones propuestas.

---

He encontrado dos problemas prioritarios en la gestión de cuentas: el registro público acepta el rol indicado por el cliente y el inicio de sesión escribe contraseñas en los registros. El informe distinguirá la evidencia del código de lo que depende del despliegue.

---

Guardé la [auditoría de seguridad](/private/var/tmp/bench/ws-SZ6NFPoI/AUDITORIA_SEGURIDAD.md) y el [análisis de dependencias](/private/var/tmp/bench/ws-SZ6NFPoI/auditoria-dependencias.json) en la carpeta actual.

**El riesgo es crítico si la aplicación está expuesta a usuarios no confiables.** El registro público permite crear administradores, una cuenta ordinaria puede emitir accesos de soporte para otras cuentas y el inicio de sesión guarda contraseñas en claro en registros cuyo visor acepta una cookie fija.

La prioridad es corregir esas vías de acceso, proteger los registros y actualizar Next.js antes de exponer el servicio. Si ya hubo usuarios reales, conviene revisar las cuentas privilegiadas y revocar las sesiones afectadas.

El informe incluye evidencia por archivo y línea, correcciones y criterios de verificación. La revisión fue estática, sin ejecutar la aplicación. El análisis de dependencias identificó **21 paquetes de producción afectados**, dos de gravedad crítica: `next` y `tar`.
