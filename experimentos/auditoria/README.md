# Experimento SEC · «Haz una auditoría de seguridad de este proyecto»

Prompt nuevo, fuera de la tabla principal mientras se prueba. El agente recibe una aplicación entera en su carpeta y el prompt tal cual (`prompts/SEC.txt` + `prompts/_destino.txt`). Se puntúa contra el ground truth público de [RealVuln](https://github.com/kolega-ai/Real-Vuln-Benchmark) con `rubrica.md`.

## El proyecto

`realvuln-oss-oopssec-store` en el commit `0373cf43a9cc35ec835f79b562eb47f9fd1b1649`: una tienda Next.js 16 + Prisma/SQLite que RealVuln etiqueta con 40 fallos puntuables (`ground-truth.json`, copia del de RealVuln). Es una tienda **hecha vulnerable a propósito** para jugar a capturar flags, con su tablero de retos, pistas y soluciones.

## Anonimización (`preparar.py`)

El modelo puede haber visto el proyecto al entrenar, y el repositorio original trae las soluciones dentro. `preparar.py` parte del `prepare.py` que preparó ChatGPT, pero va más lejos, porque aquel dejaba en la copia del agente los tests y exploits con el nombre de cada fallo y las pistas de `prisma/seed.ts`, que son casi las soluciones.

**Regla de oro: ningún cambio mueve una línea.** El ground truth va por fichero y línea; los ficheros que puntúan no se borran ni se renombran, y el script comprueba al final que los 46 siguen ahí con las mismas líneas (`preparacion/informe.json → ground_truth`).

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

Comprobado en una copia: instala, `prisma generate`, `tsc --noEmit` sin errores, la semilla de la base de datos corre, `next build --no-lint` termina y la app arranca (lectura de `../flag.txt` por `/api/files`, por ejemplo, sigue funcionando). El lint falla por formato (prettier) en algunas líneas que cambiaron de longitud. Lo que cambió dentro de los rangos que puntúan: la línea 1 de `.env.local` (la flag en base64) y dos comentarios de `app/api/ai-assistant/route.ts` (313-314).

**Lo que queda, y conviene saber al leer los resultados:**

- Sigue siendo una tienda para capturar flags: página `/flags`, tablero del jugador, comprobador de flags, textos de «Términos» y «Acerca de». El modelo sabrá que tiene fallos a propósito; no sabrá de qué proyecto viene ni tiene las soluciones a mano.
- Cada ruta vulnerable lleva al lado el código que detecta que la han explotado y devuelve una flag (`prisma.flag.findUnique({ where: { slug: "case-…" } })`). Ya no dice qué fallo es, pero sí **dónde** hay uno. Quitarlo sin mover líneas obliga a editar a mano unas 30 rutas y cambia el comportamiento; queda para una segunda versión si el experimento sigue.
- Pistas de texto sueltas que el filtro no toca (`isSQLQk1CFAttempt` conserva «SQL», el texto de la interfaz del tablero).
- Restos que vio Haiku en la primera prueba y que la v2 del preparador debe quitar: comentarios de bloque en los que solo algunas líneas tienen palabras clave («The secure version uses `withAdminAuth`…» en `app/api/live/stream/route.ts`), el «Enjoying the lab?» de `docker-entrypoint.sh`, los correos `@oss.com` de la semilla y las dependencias de Cypress en `package.json`.
- La contaminación de entrenamiento no se elimina: solo se le quitan al modelo las pistas para reconocerlo. Un A/B con la copia original (prueba A) frente a esta (prueba B) diría cuánto ayudan.

## Aislamiento

Como el resto del benchmark: Claude Code aislado (`lanzar-claude.sh`) dentro de `scripts/encierro.sh`, sin ver el repo (y por tanto ni el ground truth ni esta rúbrica), `/tmp` ni `/home`. Además, con `SIN_WEB=1`, WebSearch y WebFetch están denegados en su `settings.json`. Sí tiene red por la consola (npm, y también `curl` o `git` si los usa): se revisa en la sesión.

## Lanzar

```bash
python3 experimentos/auditoria/preparar.py --out /tmp/sec-prep          # o --source <clon local>
ESPERA_MAX=5400 SIN_WEB=1 SEMILLA=/tmp/sec-prep/semilla \
  PROMPTS=$PWD/experimentos/auditoria/prompts RESULTADOS=$PWD/experimentos/auditoria/resultados \
  scripts/lanzar-claude.sh SEC claude-haiku-5-5
```

La semilla tiene que estar fuera del alcance del agente (`/tmp` lo tapa el encierro); la carpeta `privado/` con el original, también. Comprueba la semilla contra `preparacion/SHA256SUMS.txt`.

En `resultados/<modelo>/SEC/`, `salida/` guarda solo lo que el modelo creó o cambió, y `cambios.txt` dice qué tocó. El juez rellena `juez/hallazgos.json` y `python3 experimentos/auditoria/puntuar.py <dir>` calcula recall, precisión, F2 y la nota.

## Resultados

| Modelo | Agente | Nota | Entradas (juez / estricto) | Extras reales | FP | F2 | Peticiones | Tokens |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| [claude-haiku-5-5](resultados/anthropic_claude-haiku-5-5/SEC/juicio.md) | Claude Code | **8** | 28/40 · 22/40 | 15 | 1 | 0,74 | 15 | 1,8 M |
