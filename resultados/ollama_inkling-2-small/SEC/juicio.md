# SEC · inkling-2-small (Ollama) · 7/10

**Buena cobertura, sin líneas**

## Validación

Cruce a mano de los 46 hallazgos de `salida/SECURITY_AUDIT.md` (44 numerados y dos que solo están en las cadenas de ataque: XXE y open redirect) con el ground truth (`juez/hallazgos.json`; cifras en `juez/puntuacion.json`). Cada hallazgo sin entrada se comprobó en el código de la copia.

| | Estricto (nota) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | 31 | 32 |
| F3 | 75,1 | 80,4 |
| wF3 | 75,2 | |
| Falsos positivos | 22 (incluye 15 fallos reales sin etiquetar) | 6 |

Rúbrica: F3 6/7, críticas 1 (4 de 6; fallan el oráculo de padding y las credenciales del seed), fichero y línea 0 (7 %), CWE 0 (ninguno).

## Lo que está bien

- Cubre casi todo lo que se ve leyendo las rutas: alta como ADMIN, secreto JWT, tres SQLi, path traversal en sus dos vectores, support-access con email ajeno, IDOR de pedidos y wishlists, las dos SSRF, XSS de analytics y reseñas, SVG subido, flags públicas, prompt injection directa e indirecta, contraseñas en el log y credenciales fijas.
- Nombra el fichero de cada hallazgo, y con la regla de RealVuln eso basta cuando no hay línea: por eso puntúa casi igual que un informe con líneas.
- Encuentra fallos reales que RealVuln no etiqueta (middleware sin firma, reset predecible, /internal por cabecera, cupones, tarjetas regalo, CSV injection, sesiones de soporte de un año).

## Lo que falta o está mal

- No cubre: el oráculo de padding de `documents/share` (crítica), las credenciales del seed (crítica), la fuga de la URL y las herramientas del asistente, el logout, el token de soporte en claro y la página de noticias.
- Dice que hay SQLi en `admin/reviews`, pero solo en el resumen y en las prioridades, sin hallazgo; no se cuenta. El open redirect solo aparece en una cadena de ataque y sin fichero: vale para el juez, no para la nota.
- Solo 3 de 46 hallazgos traen línea y ninguno CWE. Seis no son fallos: dos son controles que están bien y el resto no se sostiene o es higiene.

## Rarezas de la sesión

- Ejecuta npm audit y lo consigue: sale al registro de npm pese a correr sin web (webfetch y websearch estaban denegados, el shell no).
- Vuelca todas las rutas API a /tmp/opencode/api-routes.txt, fuera de la carpeta de trabajo, para leerlas por trozos.
- No nombra el proyecto original; ve las flags QKB{…} y avisa de que no reproduce sus valores.
- La tabla del resumen dice 8 medios y 6 bajos; el informe trae 10 y 15. Dos de los bajos son controles que están bien (B-12, B-15).
- XXE y open redirect solo aparecen en las cadenas de ataque, sin hallazgo propio; la SQLi de admin/reviews solo en el resumen y en las prioridades.
- Casi no da líneas (3 de 46 hallazgos) ni ningún CWE.
- No toca el código: solo crea SECURITY_AUDIT.md. 16 peticiones, 2 min 9 s.
