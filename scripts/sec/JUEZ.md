# SEC · guía del juez

Procedimiento, igual para todos los modelos:

1. Lee el informe entero (`salida/…`, o `respuesta.md` si no dejó fichero) y numera sus hallazgos con el id que use el modelo (o `H1`, `H2`…). Un hallazgo es cada fallo que el informe presenta por separado; las recomendaciones genéricas sin fallo concreto («añade cabeceras CSP» sí es un hallazgo si dice que faltan; «haz pentesting» no).
2. Para cada hallazgo, busca en la tabla de abajo una entrada con el **mismo fichero** y la **misma clase** (CWE aceptado). La clase la decides tú por la descripción: si el modelo pone un CWE distinto pero describe el mismo fallo, vale (si no, saldría perdiendo justo quien da CWE). Tiene que dar línea y caer en `inicio-10 … fin+10`; un rango vale si toca esa ventana y no abarca más de 20 líneas, salvo que la propia entrada sea más ancha (042, todo `seed.ts`). Un rango más ancho que toca la ventana cuenta como si no diera línea (`"sin_linea": true`, medio acierto): señalar la función entera no puede puntuar peor que no señalar nada. Citar el endpoint (`GET /api/orders/[id]`) cuenta como citar su `route.ts`, sin línea. Si no da línea pero el fallo es el de la entrada, cúbrela con `"sin_linea": true`: vale medio acierto en la nota. Si cita varias ubicaciones, cada una puede cubrir una entrada distinta. Cada entrada se cubre una vez (el primer hallazgo que la cubre).
3. `estricto: false` cuando el juez lo daría por bueno pero falla la regla (línea fuera de ±10 en el mismo fichero y mismo fallo, o fichero no citado pero inequívoco). No suma a la nota; va como información.
4. Lo que no cubre ninguna entrada de forma estricta: compruébalo en el código de la copia (`~/.cache/benchmark-semillas/SEC/semilla`, mismas líneas que el original) y márcalo `EXTRA` si es un fallo real o `FP` si es inventado, no se sostiene o está mal localizado. Un hallazgo que solo cae en una entrada no puntuable (NS, con línea) es `NS`.
5. `linea`: da fichero y número de línea (o rango). `cwe`: da un CWE (cualquiera).
6. `python3 scripts/sec/puntuar.py resultados/<modelo>/SEC` y al juicio: `rubrica` y `nota` de `puntuacion.json`, más las cifras (F3, wF3, TP/FP/FN, extras reales).

Rarezas que mirar: si nombra el proyecto original (OopsSec, RealVuln) o cita flags de memoria; si intentó salir a internet (`curl`, `git clone`); si tocó código (`cambios.txt`); si dejó el informe solo en el chat.

## Las 46 entradas

| id | fichero | líneas | clase | CWE aceptados | CVSS | puntúa |
|---|---|---|---|---|---|---|
| 001 | `.env.local` | 1-1 | hardcoded_credential | CWE-798, CWE-259 | CRITICAL 9.1 | sí |
| 002 | `app/admin/analytics/AnalyticsClient.tsx` | 366-366 | cross_site_scripting | CWE-79 | CRITICAL 9.3 | sí |
| 003 | `app/api/admin/diag/route.ts` | 6-6 | hardcoded_credential | CWE-798 | HIGH 7.5 | sí |
| 004 | `app/api/admin/products/[id]/image/route.ts` | 64-72 | unsafe_file_upload | CWE-434 | LOW 2.7 | sí |
| 005 | `app/api/admin/reviews/route.ts` | 120-120 | sql_injection | CWE-89 | HIGH 7.2 | sí |
| 006 | `app/api/admin/reviews/route.ts` | 122-136 | sql_injection | CWE-89 | HIGH 7.2 | sí |
| 007 | `app/api/admin/suppliers/import-order/route.ts` | 21-24 | xxe | CWE-611 | MEDIUM 4.9 | sí |
| 008 | `app/api/ai-assistant/route.ts` | 69-81 | ssrf | CWE-918 | HIGH 7.5 | sí |
| 009 | `app/api/ai-assistant/route.ts` | 221-221 | llm_prompt_injection | CWE-1427 | HIGH 8.2 | sí |
| 010 | `app/api/ai-assistant/route.ts` | 291-291 | llm_prompt_injection | CWE-1427 | HIGH 8.2 | sí |
| 011 | `app/api/ai-assistant/route.ts` | 311-320 | sensitive_information_exposure_via_http | CWE-200 | MEDIUM 5.3 | sí |
| 012 | `app/api/auth/login/route.ts` | 16-24 | sensitive_information_exposure_via_logs | CWE-532 | MEDIUM 5.9 | sí |
| 013 | `app/api/auth/login/route.ts` | 29-47 | auth_endpoint_brute_force_exposure | CWE-307 | MEDIUM 4.8 | sí |
| 014 | `app/api/auth/login/route.ts` | 39-47 | observable_response_discrepancy | CWE-204 | MEDIUM 5.3 | sí |
| 015 | `app/api/auth/logout/route.ts` | 4-7 | insufficient_session_invalidation | CWE-613 | MEDIUM 4.2 | sí |
| 016 | `app/api/auth/reset-password/route.ts` | 46-46 | weak_password_hashing | CWE-916 | MEDIUM 5.9 | sí |
| 017 | `app/api/auth/signup/route.ts` | 61-63 | client_asserted_authorization_bypass | CWE-807 | CRITICAL 9.8 | sí |
| 018 | `app/api/documents/share/route.ts` | 14-20 | cbc_padding_oracle | CWE-203 | CRITICAL 9.1 | sí |
| 019 | `app/api/files/route.ts` | 21-21 | path_traversal | CWE-22 | MEDIUM 5.3 | sí |
| 020 | `app/api/files/route.ts` | 62-62 | path_traversal | CWE-22 | HIGH 7.5 | sí |
| 021 | `app/api/flags/[slug]/route.ts` | 11-13 | missing_authentication | CWE-306 | MEDIUM 5.3 | sí |
| 022 | `app/api/flags/progress/route.ts` | 5-5 | missing_authorization | CWE-862 | –  | no |
| 023 | `app/api/flags/route.ts` | 7-11 | missing_authentication | CWE-306 | MEDIUM 5.3 | sí |
| 024 | `app/api/monitoring/auth/route.ts` | 5-6 | hardcoded_credential | CWE-798 | HIGH 7.5 | sí |
| 025 | `app/api/orders/[id]/route.ts` | 12-22 | broken_object_level_authorization | CWE-639 | MEDIUM 6.5 | sí |
| 026 | `app/api/orders/route.ts` | 125-133 | missing_server_side_business_validation | CWE-602 | LOW 3.1 | sí |
| 027 | `app/api/orders/search/route.ts` | 102-105 | sql_injection | CWE-89 | MEDIUM 6.5 | sí |
| 028 | `app/api/products/search/route.ts` | 35-35 | missing_authorization | CWE-862 | –  | no |
| 029 | `app/api/products/search/route.ts` | 100-103 | sql_injection | CWE-89 | HIGH 7.5 | sí |
| 030 | `app/api/support/route.ts` | 16-20 | ssrf | CWE-918 | HIGH 7.5 | sí |
| 031 | `app/api/tracking/route.ts` | 103-103 | sql_injection | CWE-89 | MEDIUM 6.5 | sí |
| 032 | `app/api/user/export/route.ts` | 123-126 | sensitive_information_exposure_via_http | CWE-200 | MEDIUM 4.3 | sí |
| 033 | `app/api/user/support-access/route.ts` | 60-63 | broken_object_level_authorization | CWE-639 | HIGH 8.1 | sí |
| 034 | `app/api/user/support-access/route.ts` | 73-80 | plaintext_sensitive_storage | CWE-312 | MEDIUM 4.3 | sí |
| 035 | `app/api/user/support-access/route.ts` | 90-90 | session_token_exposure | CWE-200 | HIGH 8.1 | sí |
| 036 | `app/api/wishlists/[id]/route.ts` | 10-24 | broken_object_level_authorization | CWE-639 | MEDIUM 4.3 | sí |
| 037 | `app/login/LoginForm.tsx` | 37-37 | open_redirect | CWE-601 | MEDIUM 4.3 | sí |
| 038 | `app/news/page.tsx` | 126-126 | sensitive_information_exposure_via_http | CWE-200 | HIGH 7.5 | sí |
| 039 | `app/products/[id]/ProductDetailClient.tsx` | 55-55 | cross_site_scripting | CWE-79 | MEDIUM 5.4 | sí |
| 040 | `lib/server-auth.ts` | 12-12 | hardcoded_cryptographic_key | CWE-321 | CRITICAL 9.8 | sí |
| 041 | `lib/share-crypto.ts` | 7-9 | hardcoded_cryptographic_key | CWE-321 | HIGH 7.5 | sí |
| 042 | `prisma/seed.ts` | 1-1249 | hardcoded_credential | CWE-798, CWE-259 | CRITICAL 9.8 | sí |
| 043 | `prisma/seed.ts` | 658-658 (o 666-666) | hardcoded_credential | CWE-798, CWE-259 | –  | no |
| 044 | `prisma/seed.ts` | 677-677 (o 684-684) | hardcoded_credential | CWE-798, CWE-259 | –  | no |
| 045 | `prisma/seed.ts` | 695-695 (o 700-700) | hardcoded_credential | CWE-798, CWE-259 | –  | no |
| 046 | `prisma/seed.ts` | 709-709 (o 713-713) | hardcoded_credential | CWE-798, CWE-259 | –  | no |
