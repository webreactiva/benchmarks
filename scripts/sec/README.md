# SEC · «Haz una auditoría de seguridad de este proyecto»

Prompt del benchmark desde el 23 nov. 2026 (empezó como experimento). La rúbrica está en `rubricas.md` y es exigente: la métrica y la regla de cruce de RealVuln (F3). El agente recibe una aplicación entera en su carpeta y el prompt tal cual (`prompts/SEC.txt` + `prompts/_destino.txt`). Se puntúa contra el ground truth público de [RealVuln](https://github.com/kolega-ai/Real-Vuln-Benchmark).

## El proyecto

`realvuln-oss-oopssec-store` en el commit `0373cf43a9cc35ec835f79b562eb47f9fd1b1649`: una tienda Next.js 16 + Prisma/SQLite que RealVuln etiqueta con 40 fallos puntuables (`ground-truth.json`, copia del de RealVuln). Es una tienda **hecha vulnerable a propósito** para jugar a capturar flags, con su tablero de retos, pistas y soluciones.

## Anonimización (`preparar.py`)

El modelo puede haber visto el proyecto al entrenar, y el repositorio original trae las soluciones dentro. `preparar.py` parte del `prepare.py` que preparó ChatGPT, pero va más lejos, porque aquel dejaba en la copia del agente los tests y exploits con el nombre de cada fallo y las pistas de `prisma/seed.ts`, que son casi las soluciones.

**Regla de oro: ningún cambio mueve una línea.** El ground truth va por fichero y línea; los ficheros que puntúan no se borran ni se renombran, y el script comprueba al final que los 46 siguen ahí con las mismas líneas (`preparacion/v2/informe.json → ground_truth`).

| Qué | Cómo |
|---|---|
| Nombre | **Quokka Bazaar** (`quokka-bazaar`): marca, logotipos en ASCII, `package.json`, enlaces a GitHub y a la documentación |
| Soluciones y pistas | Fuera `docs/`, `content/vulnerabilities/`, `tests/`, `cypress/`, `public/exploits/`, `lab/`, `packages/`, `hall-of-fame/`, las páginas `app/vulnerabilities` y `app/hall-of-fame`, `README`, `AGENTS.md`, `.cursor/`, `.github/`, `.husky/` |
| `prisma/seed.ts` | Las 105 pistas, vacías (`""`); CWE, OWASP, CVE, writeup y categoría de cada reto, en blanco |
| Flags | `OSS{p4th_tr4v3rs4l_4tt4ck}` y compañía pasan a `QKB{<hash>}` en todos los ficheros, también la que va en base64 en `.env.local` |
| Nombres de reto | Los 35 *slugs* (`sql-injection`, `path-traversal`…) pasan a `case-<hash>` en todo el código |
| Identificadores | 20 que señalaban el fallo (`sqlInjectionDetected`, `csrfFlag`, `createWeakJWT`…) pasan a nombres neutros, en todo el proyecto a la vez |
| Comentarios | Los que delatan (`// VULNERABLE BY DESIGN…`, `# intentional`…) se vacían sin quitar la línea |
| Ficheros que señalan | `flag-xxe.txt` → `supplier-registry.txt`, `public/xss-flag.txt` → `public/notice.txt` |

### v2: lo que delataba dónde mirar sin revisar

Con la v1, Haiku dijo en su informe que el proyecto «parece un laboratorio deliberadamente vulnerable» por las flags y por comentarios como «The secure version uses…». Y el código daba más: al lado de cada fallo, la app comprobaba si lo habían explotado (`isSQLInjectionAttempt(status)`, «¿la petición viene de otra web?») y devolvía un premio. Eso señala la línea sin necesidad de entender el código. La v2 lo quita, también sin mover líneas, con `limpiar-ctf.js` (usa el compilador de TypeScript) y unos parches a mano comprobados uno a uno:

| Qué | Cómo |
|---|---|
| Comentarios | **Todos** fuera (salvo `@ts-…` y `eslint-…`), también los `#` de shell, Dockerfile, YAML y `.env.local`. La v1 solo quitaba los que tenían palabras clave y se escapaban bloques enteros |
| Código que premia la explotación | En 28 sitios: la consulta de la flag, las variables y `if` que solo servían para darla, la propiedad `flag` de las respuestas y sus tipos. Después, los detectores que se quedan sin uso: variables que solo se escriben, `if` vacíos, funciones a las que ya no llama nadie |
| La capa de juego | Fuera el tablero, el comprobador de flags, el panel de pistas, la guía, las páginas «Acerca de» y «Términos», la API de pistas, las etiquetas de categorías de vulnerabilidad (`BOLA`, `XXE`, `IDOR`…) y sus tipos, y los enlaces ocultos a las páginas de exploits |
| Pistas en el propio código | `hint: "The secret is not so secret"` dentro del token de sesión (login, alta y soporte); `BFLA_FLAG_SLUG` (BFLA es el nombre del fallo) → `LIVE_EVENT_SLUG`; el campo `csrfExploited` del esquema → `profileSyncPending` y su detector; `LOGIN_FLAG` → `AUDIT_TAG` |
| Restos de la v1 | «Enjoying the lab?» del entrypoint, correos `@oss.com`, scripts y dependencias de tests (Cypress, Jest, Husky) en `package.json` (el `package-lock.json` se regenera) |

Se queda: la API `/api/flags` y la tabla `flags` (son tres entradas del ground truth), las flags que esconden los ficheros que leen los fallos (`flag.txt`, `supplier-registry.txt`), la semilla con sus retos sin pistas, y el código vulnerable, que no se toca. La contaminación de entrenamiento no se elimina: solo se quitan las pistas para reconocerlo.

**Comprobado** (`preparacion/`): `tsc --noEmit` sin errores, semilla, `next build` y la app arrancada. Siguen funcionando el path traversal, el alta como ADMIN, el IDOR de pedidos, la SSRF de soporte, el XXE (lee `/etc/hostname`) y la inyección SQL de la búsqueda de pedidos. Dentro de los rangos que puntúan solo cambian 4 líneas: la flag en base64 de `.env.local:1`, dos comentarios de `ai-assistant/route.ts` (313-314) y el nombre `LOGIN_FLAG` → `AUDIT_TAG` en `login/route.ts:20,24`; el fallo (la contraseña en claro en el log) sigue igual. El lint de formato falla en las líneas que cambiaron de longitud.

## Aislamiento

Como el resto del benchmark: Claude Code aislado (`lanzar-claude.sh`) dentro de `scripts/encierro.sh`, sin ver el repo (y por tanto ni el ground truth ni esta rúbrica), `/tmp` ni `/home`. Además, con `SIN_WEB=1`, WebSearch y WebFetch están denegados en su `settings.json`. Sí tiene red por la consola (npm, y también `curl` o `git` si los usa): se revisa en la sesión.

## Lanzar

Como cualquier otro prompt: `scripts/benchmark.sh -p SEC MODELO`. Los lanzadores piden la copia a `scripts/semilla.sh SEC`, que la deja en `~/.cache/benchmark-semillas/SEC/` (fuera del alcance del agente, con `privado/` y el original) y la prepara si no existe:

```bash
python3 scripts/sec/preparar.py --out ~/.cache/benchmark-semillas/SEC   # --source <clon local>, --typescript <node_modules>
```

Con semilla, los lanzadores copian el proyecto en la carpeta del agente, le quitan la búsqueda web (`SIN_WEB=1`: WebSearch/WebFetch en Claude Code, `webfetch`/`websearch` en OpenCode), le dan 90 minutos (`ESPERA_MAX=5400`) y guardan en `salida/` solo lo que creó o cambió (`cambios.txt`). La copia debe coincidir con `preparacion/v2/SHA256SUMS.txt` (salvo `package-lock.json`, que se regenera); `semilla.sh` avisa si no.

El juez rellena `juez/hallazgos.json` y `python3 scripts/sec/puntuar.py resultados/<modelo>/SEC` calcula F3, wF3, precisión, recall y la nota.

## Resultados

En la tabla principal del `README.md`, columna SEC. La primera prueba de Haiku 5.5 sobre la v1 de la copia está en `resultados/_descartados/anthropic_claude-haiku-5-5-SEC-v1/` (5/10, F3 54,6): sirve para ver cuánto pesaban las pistas que quitó la v2.
