# SEC · claude-haiku-5-5 · 8/10

**Amplio, preciso, sin la IA**

## Validación

Cruce a mano de los 39 hallazgos de `salida/auditoria-seguridad.md` con `ground-truth.json` (`juez/hallazgos.json`, cifras en `juez/puntuacion.json`). Se comprobó en el código cada hallazgo que no está en el ground truth.

| | Juez | Estricto (RealVuln) |
|---|---:|---:|
| Entradas cubiertas (de 40) | 28 | 22 |
| Recall | 70 % | 55 % |
| F2 | 0,74 | 0,60 |

Precisión 97 %: 23 hallazgos caen en entradas del ground truth, 15 son fallos reales sin etiquetar (middleware que no verifica la firma, reset con token predecible, carrera en cupones, BFLA del stream…) y 1 no es un fallo. Críticas: 5 de 6 (falla el padding oracle). Rúbrica: cobertura 5, críticas 1, precisión 1, verificable 0, informe 1.

## Lo que está bien

- Cubre casi todo lo que se ve leyendo rutas: las cinco SQLi, XXE, SSRF de soporte, path traversal, IDOR de pedidos y wishlists, alta como ADMIN, claves y credenciales fijas, el XSS de analytics encadenado con la IP de `/api/tracking`.
- Muy pocos inventos: solo B-04 (rol en `localStorage`) no es un fallo, y el propio informe lo dice.
- Encuentra fallos reales que RealVuln no etiqueta; los cuenta en la precisión, no en el recall.
- Informe ordenado por gravedad, con plan de corrección y aspectos positivos.

## Lo que falta o está mal

- El asistente de IA (SSRF en la URL del servidor MCP, dos prompt injection, fuga de la URL interna): lo lee y no dice nada. Cuatro entradas.
- Padding oracle en `documents/share` (crítica), XSS en la ficha de producto, enumeración de usuarios en el login, MD5 de la contraseña en `reset-password`, token de soporte guardado en claro y expuesto en la URL, exposición en `news/page.tsx` y el redirect de `LoginForm.tsx`.
- Seis aciertos tienen la línea fuera de la tolerancia de RealVuln: señala la rama que deja pasar en vez de la consulta sin filtro.
- Los hallazgos medios y bajos solo traen fichero y corrección, sin punto de entrada ni reproducción: el 59 % es verificable, lejos del 80 %.

## Rarezas de la sesión

- No reconoce el proyecto original: lo llama «laboratorio de formación deliberadamente vulnerable» por las flags QKB{…} y los comentarios que quedaron, sin nombrar OopsSec ni RealVuln.
- Lee app/api/ai-assistant/route.ts y lib/prompt-injection-filter.ts y no reporta nada: ni SSRF ni prompt injection.
- Ejecuta npm audit (única salida a la red) y deja npm-audit.json junto al informe.
- No toca el código: solo crea el informe y el JSON de npm audit.
- Escribe la salida de npm audit en /tmp del encierro antes de copiarla a su carpeta.
