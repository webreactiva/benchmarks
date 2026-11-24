Revisando las rutas de API; llevo ya varios hallazgos críticos (escalada de rol en signup, JWT débil, tokens predecibles). Sigo.

---

Quedan las últimas rutas de API, las páginas cliente (XSS) y el seed; después redacto el informe.

---

Ya tengo todo el código revisado; redacto el informe.

---

He terminado la auditoría y está guardada en `/var/tmp/bench/ws-2Thizg1X/AUDITORIA_SEGURIDAD.md`. He revisado el código a mano, sin levantar la aplicación ni ejecutar ningún ataque, así que los vectores salen de leer el código. Tampoco he ejecutado `npm audit`: las CVE las he identificado por las versiones declaradas en `package.json`.

**Contexto:** el proyecto parece una aplicación vulnerable a propósito, de entrenamiento o tipo CTF (tiene `flag.txt`, una tabla `Flag` con *walkthroughs* y cadenas `QKB{…}`). Aun así, he tratado cada fallo como si fuera un sistema real.

**Resultado:** 48 hallazgos (14 críticos, 16 altos, 11 medios y 7 bajos). Los más graves:

- **Cualquiera puede hacerse administrador:**
  - Al registrarse se acepta el campo `role:"ADMIN"`.
  - El secreto que firma los tokens de sesión es `"secret"` por defecto.
  - El middleware no verifica la firma de esos tokens, y Next 15.2.2 tiene además la CVE-2025-29927, que permite saltárselo.
  - Se pueden pedir tokens de soporte para la cuenta de otro usuario.
  - El token de restablecer contraseña es predecible: un MD5 del email más la hora.
- **Ejecución remota de código y lectura de ficheros:**
  - React 19.2.0 tiene la CVE-2025-55182.
  - La importación XML de proveedores es vulnerable a XXE.
  - `/api/files` lee cualquier fichero del servidor sin pedir autenticación (por ejemplo, `?file=../.env.local`).
- **Inyección SQL** en 4 endpoints, dos de ellos sin autenticación. El de reseñas de administración permite además encadenar sentencias de escritura.
- **SSRF** en `/api/support` y en el asistente IA, que acepta una URL de servidor MCP elegida por el usuario.
- **XSS almacenado:** en las reseñas (se ejecutan incluso las etiquetas `<script>`), en el panel de analítica (a través de la cabecera `X-Forwarded-For`), en la subida de imágenes SVG y en el formulario de soporte.
- **Fallos de autorización y de lógica de negocio:** cualquier usuario puede ver pedidos y listas de deseos ajenos, el total del pedido lo envía el cliente, los cupones se pueden usar varias veces con peticiones en paralelo y los códigos de tarjeta regalo son predecibles.
- **Secretos y contraseñas expuestos:**
  - `NEXT_PUBLIC_PAYMENT_SECRET` acaba en el JavaScript que se sirve al navegador.
  - `.env.local` se copia dentro de la imagen Docker.
  - Las contraseñas se escriben en claro en los logs, que se leen desde la consola SIEM con `root`/`admin`.
  - Las contraseñas se guardan con MD5 sin sal.

He encontrado también una nota HTML oculta en el panel de documentos que menciona un paquete `react-toastfy` traído de un "registro interno". Su nombre imita al de `react-toastify` y podría ser un intento de ataque a la cadena de suministro. Ahora mismo no aparece en las dependencias, pero conviene vigilarlo.

El informe incluye para cada hallazgo el fichero y la línea, el impacto y la corrección, además de siete cadenas de ataque de principio a fin y un plan de remediación por prioridades. Lo primero sería actualizar React y Next, eliminar el campo `role` del registro, exigir un secreto robusto para los tokens, parametrizar las consultas SQL y rotar todos los secretos expuestos.
