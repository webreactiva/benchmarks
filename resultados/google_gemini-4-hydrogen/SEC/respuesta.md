Se ha completado la auditoría de seguridad del proyecto **Quokka Bazaar** y el informe detallado se ha guardado en la carpeta actual como `AUDITORIA_SEGURIDAD.md`.

### Resumen de hallazgos principales

- **Severidad Crítica (8 hallazgos):**
  1. **Inyección SQL (x4):** Consultas concatenadas con `$queryRawUnsafe` o `better-sqlite3` (`db.exec`) en `app/api/products/search/route.ts`, `app/api/orders/search/route.ts`, `app/api/admin/reviews/route.ts` y `app/api/tracking/route.ts`.
  2. **Escalada de privilegios en registro:** `app/api/auth/signup/route.ts` y `lib/validation/schemas/auth.ts` aceptan un campo `role` enviado por el cliente, permitiendo crear cuentas `ADMIN`.
  3. **Suplantación y fallo de revocación en tokens de soporte:** `app/api/user/support-access/route.ts` permite emitir tokens para cualquier `email` sin validar propiedad/rol, y `app/api/auth/support-login/route.ts` no comprueba `supportToken.revoked`.
  4. **Secreto JWT por defecto y validación débil:** `lib/server-auth.ts` usa `"secret"` como fallback, omite verificar `alg` y obligatoriedad de `exp`, y compara firmas sin tiempo constante.
  5. **XXE en importación XML:** `app/api/admin/suppliers/import-order/route.ts` configura `libxmljs2` con `{ noent: true, dtdload: true }`.
  6. **Path Traversal sin autenticación:** `app/api/files/route.ts` permite listar y leer archivos fuera de `documents/` sin autenticación ni validación de ruta.
  7. **Token de restablecimiento de contraseña predecible:** `app/api/auth/forgot-password/route.ts` usa `hashMD5(email + timestamp)` y devuelve `requestedAt` en la respuesta.
  8. **Manipulación de precios en pedidos:** `app/api/orders/route.ts` acepta `total` directamente del cliente sin recalcular el carrito ni descuentos en el servidor.

- **Severidad Alta (11 hallazgos):**
  - **IDOR** en `app/api/orders/[id]/route.ts` y `app/api/wishlists/[id]/route.ts`.
  - **Control de acceso roto** en `app/api/live/stream/route.ts` (exposición de `streamKey` y modificación pública del stream por usuarios no administradores).
  - **Bypass por cabecera y rutas expuestas:** `app/internal/page.tsx` (`x-internal-request`), `app/monitoring/internal-status/page.tsx` y `app/api/flags/**`.
  - **MD5 sin sal, enumeración de cuentas y hashes expuestos** en `lib/server-auth.ts`, `app/api/auth/login/route.ts`, `prisma/seed.ts` y `app/news/page.tsx`.
  - **XSS (almacenado, reflejado y vía SVG)** en `app/products/[id]/ProductDetailClient.tsx`, `app/admin/analytics/AnalyticsClient.tsx`, `app/support/SupportForm.tsx` y `app/api/admin/products/[id]/image/route.ts` / `app/api/uploads/[...path]/route.ts`.
  - **Open Redirect** en `app/login/LoginForm.tsx`.
  - **SSRF** en `app/api/support/route.ts` y `app/api/ai-assistant/route.ts`.
  - **Condición de carrera (TOCTOU)** en cupones (`app/api/orders/route.ts`).
  - **Logs con contraseñas en texto plano** (`app/api/auth/login/route.ts`) y credenciales hardcodeadas/cookie estática en SIEM (`app/api/monitoring/auth/route.ts`, `app/api/monitoring/logs/route.ts`).
  - **AES-256-CBC sin autenticación** y clave hardcodeada en `lib/share-crypto.ts` + oráculo de errores en `app/api/documents/share/route.ts`.
  - **Dependencias vulnerables** en `package.json` (`next@15.2.2`, `react@19.2.0`, `libxmljs2@0.37.0`).

- **Severidad Media (7 hallazgos):**
  - Generación predecible de códigos y falta de cobro en tarjetas regalo (`lib/gift-card.ts`, `app/api/gift-cards/route.ts`).
  - Exposición del campo `password` y diagnósticos internos en `app/api/user/export/route.ts`.
  - Token estático en `app/api/admin/diag/route.ts`.
  - `.env.local` no excluido en `.gitignore`/`.dockerignore` y secreto en `NEXT_PUBLIC_PAYMENT_SECRET`.
  - Filtro de prompt injection por regex trivial (`lib/prompt-injection-filter.ts`) y cabecera estática MCP (`lib/mcp-constants.ts`, `app/api/mcp/route.ts`).
  - Validación de subida de imágenes solo por `file.type`, contenedor Docker corriendo como `root` y `prisma studio` automático en `scripts/setup.sh`.
  - Ausencia de cabeceras de seguridad HTTP en `next.config.ts` y protección CSRF explícita.

En `AUDITORIA_SEGURIDAD.md` encontrarás la ubicación exacta, el detalle técnico y el plan de remediación priorizado en tres fases para cada punto.
