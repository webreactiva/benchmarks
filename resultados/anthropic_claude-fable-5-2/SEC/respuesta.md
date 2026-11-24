Ya revisé todo el código (rutas API, librerías, esquema, frontend); me falta solo el resumen de dependencias y luego escribo el informe.

---

La auditoría está guardada en `AUDITORIA_SEGURIDAD.md`, en la carpeta del proyecto. La aplicación no es apta para exponerse a Internet: encontré 40 hallazgos (11 críticos, 13 altos, 10 medios, 6 bajos).

Es una revisión estática: leí todo el código de servidor y los puntos sensibles del cliente y pasé `npm audit`, pero no levanté la aplicación ni ejecuté ningún exploit.

El proyecto parece una aplicación deliberadamente vulnerable (laboratorio o CTF): tiene una tabla `flags`, pistas y cadenas `QKB{…}` repartidas por el código. Si es así, los hallazgos son lo esperado y el informe sirve de mapa.

Lo más grave, todo explotable sin cuenta salvo que se indique:

- **Administrador en una petición:** el registro acepta `role: "ADMIN"`, y el secreto JWT por defecto es `"secret"`, así que se puede firmar cualquier sesión.
- **Toma de cuentas:** el token de reseteo de contraseña es `md5(email + segundos)` y la respuesta devuelve la hora exacta. Con una cuenta cualquiera, además, se puede emitir un token de "acceso de soporte" para otro usuario.
- **Lectura de archivos arbitrarios:** `/api/files` no pide autenticación ni confina la ruta (`../.env.local`, logs, código).
- **Inyección SQL:** en la búsqueda de productos y en el tracking (cabecera `X-Forwarded-For`), más otras dos con sesión.
- **Contraseñas en claro:** el login las escribe en los logs, y el visor de logs se abre con una cookie de valor constante.
- **Ejecución de código en el servidor:** Next.js 15.2.2 tiene una RCE conocida y un bypass de middleware; `npm audit` da 21 vulnerabilidades en dependencias de producción.
- **Precio manipulable:** el total del pedido lo fija el navegador (requiere cuenta).

El informe incluye para cada hallazgo el archivo y la línea, la corrección propuesta, cinco cadenas de ataque y un plan de corrección priorizado.
