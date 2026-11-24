---
name: benchmark-modelos
description: Lanza el benchmark propio de modelos de Web Reactiva () con uno o varios modelos, valida lo que generan y hace de juez. Cinco prompts fijos (A3D, AIF, CCA, SEC, TCI; MWP y PTS se retiraron), cada uno en una sesión nueva y aislada de OpenCode (modelos de OpenRouter) o de Claude Code (haiku, sonnet, opus), con tokens, validación, nota, veredicto y rarezas. Úsala cuando pidan «pasa el benchmark a X», «prueba este modelo con los prompts», «benchmark con haiku y gemma», «/benchmark-modelos», o quieran comparar modelos con estos prompts.
---

# Benchmark de modelos

Todo vive en este repositorio. Lee su `README.md` antes de empezar: reglas, prompts y qué hay en cada resultado.

## Reglas que no se rompen

- **El prompt es el que es.** Se manda `prompts/<CÓDIGO>.txt` tal cual más `prompts/_destino.txt` (dónde guardar). Nada más: ni aclaraciones, ni formato, ni idioma, ni «pruébalo».
- **Un mensaje por sesión.** Sesión nueva por prompt. Si pregunta, da opciones o pide que elijamos, se le contesta «Decide tú.» cada vez (el lanzador lo hace solo, hasta 5 veces); no se le pide que corrija, no se le dice que algo falla. Si se queda a medias, ese es el resultado.
- **El juez no toca la salida.** Se valida en una copia (`/tmp/...`). Los scripts del juez van en `resultados/<modelo>/<CÓDIGO>/juez/`, nunca en `salida/`.
- **Aislado.** Cada agente tiene su configuración y su `HOME`, trabaja en una carpeta con nombre aleatorio en `/var/tmp/bench/` que se borra al acabar, y corre dentro de `scripts/encierro.sh` (unshare): no ve el repo, `/tmp`, `/home`, `/mnt`, el resto de `/root` ni otros procesos. **Excepción macOS:** sin `unshare` no hay encierro; se lanza igual, con el sandbox del agente, y se apunta en `meta.json → aislamiento` (ver README). Si ve `~/.claude/skills`, un `AGENTS.md` o el trabajo de otro modelo, la prueba no vale (ver `resultados/_descartados/`). Tras cada tanda, `python3 scripts/fugas.py` lista lo que cada sesión tocó fuera de su carpeta.
- **TCI** arranca con `incidencias.jsonl` en la carpeta (`scripts/semilla.sh TCI`) y su prompt va sin `_destino.txt` (`prompts/TCI.destino`, vacío).
- **SEC** arranca con la copia anonimizada en la carpeta (`scripts/semilla.sh SEC`, en `~/.cache/benchmark-semillas/`, fuera del alcance del agente) y sin búsqueda web (`SIN_WEB=1`, lo ponen los lanzadores solos). Antes de lanzar, que la copia exista; si no, `semilla.sh` la prepara (clona el repo fijado y necesita npm).
- **Nada de asciinema.** tmux sí; grabar no hace falta.
- Una clave que pase el autor por el chat se usa como variable de entorno al lanzar, nunca se escribe en un fichero.

## 1. Lanzar

```bash
scripts/benchmark.sh MODELO [MODELO...]              # los cuatro prompts
scripts/benchmark.sh -p CCA,SEC MODELO               # solo algunos
```

- Con `/` va con OpenCode (`lanzar.sh`): `ollama/<id>` es de Ollama Cloud (`OLLAMA_CLOUD_API_KEY`; los ids, en `curl -s https://ollama.com/v1/models -H "Authorization: Bearer $OLLAMA_CLOUD_API_KEY"`) y el resto, de OpenRouter (`OPEN_ROUTER_API_KEY`). Los gratuitos (`:free`) se listan con `curl -s https://openrouter.ai/api/v1/models` filtrando precio 0, y conviene probar antes que responde (algunos dan 429 del proveedor).
- `haiku`, `sonnet`, `opus` o `claude-*` van con Claude Code aislado (`lanzar-claude.sh`). La carpeta sale del id real (`anthropic_claude-haiku-5-5`).
  - **«Not logged in» en el Claude aislado.** Claude Code busca el login en `CLAUDE_CONFIG_DIR/.credentials.json` y, desde la 2.1.33x, también en `$HOME/.config/anthropic/active_config` y `configs/default.json`. En la nube lo lee de `/home/claude/.claude/remote/.oauth_token`. El encierro tapa `/home`, así que `lanzar-claude.sh` pasa `TOKEN_CLAUDE=1` y `encierro.sh` monta solo ese fichero, de solo lectura y en la misma ruta (OpenCode y Codex no lo ven). En local, con `HOME` y configuración propios, inicia sesión una vez a mano en la del aislado (`tmux attach -t c-CÓDIGO` y `/login`).
  - Para saber de dónde saca la credencial: `strace -f -e trace=openat -o traza.txt claude -p "hola"` y `grep -E 'remote/\.|credentials|config/anthropic' traza.txt`. Que `-p` funcione fuera del encierro no prueba que funcione dentro.
  - En una carpeta de configuración nueva, marca `"hasCompletedOnboarding": true` en su `.claude.json`: sin eso arranca en el selector de login (no está comprobado si pasa también con credencial, pero no estorba).
  - Tareas en segundo plano: si el modelo cierra su turno con algo aún en marcha («Esperando a que termine…»), `lanzar-claude.sh` lo da por acabado y cierra la sesión (le pasó a claude-fable-5-2 en A3D, con el HTML ya terminado). Míralo en `pantalla.txt` y apúntalo como rareza. `claude-aislado.sh` deja pasar `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` por si el autor quiere desactivarlas.
  - Si el login falla, `lanzar-claude.sh` deja `resultados/anthropic_/` (sin modelo) con un `meta.json` vacío: bórrala antes de relanzar.
- `gpt-*` va con Codex CLI (`lanzar-codex.sh`, `codex exec`): `ESFUERZO=medium scripts/benchmark.sh gpt-6.2-sol` (`ESFUERZO=default`: el del modelo). La carpeta es `openai_<modelo>-<esfuerzo>`. Usa la cuenta de `~/.codex/auth.json` (se copia a un `CODEX_HOME` propio).
- Cada modelo tiene su configuración de OpenCode (`~/.opencode-bench/<modelo>`), pero **los de Ollama Cloud van de uno en uno**: un solo `benchmark.sh` con todos los modelos seguidos (`benchmark.sh -p SEC ollama/a ollama/b …`), nunca varios a la vez. Lo pidió el autor: varios a la vez llenan este contenedor y se cae. **Kimi-K3.1-pro, siempre el último de la cola:** es el que más consume (un SEC suyo, 3,6 M de tokens, agotó el cupo de la sesión). TCI antes que SEC: es mucho más barato. `benchmark.sh` se para al primer «usage limit» de Ollama. Un modelo de Ollama y otro de otro proveedor o agente sí pueden coincidir.
- Los límites salen de `scripts/limites.py` (contexto y salida reales del proveedor; la salida, como mucho la mitad del contexto, porque OpenCode la reserva y con salida = contexto compacta sin parar). Si `meta.json → compactaciones` es alto en una prueba corta, revisa los límites.
- Antes de los límites reales, OpenCode cortaba una respuesta en 32 000 tokens de salida si el proveedor no declara `limit` (`finish: length` en la sesión, carpeta vacía): es un 0 y se apunta como rareza.
- Si el modelo pregunta con la herramienta de preguntas, el lanzador la cierra y le contesta «Decide tú.» cada vez (`meta.json` → `veces_decide_tu`). Si pregunta en texto y se para sin hacer nada, contéstale tú «Decide tú.» en esa misma sesión.
- **Una tirada.** Solo se repite por un fallo técnico (error de la API, desconexión, sesión que no responde, un límite nuestro). La prueba fallida va a `_descartados/` con un `motivo.txt`. Un mal resultado no se repite.
- Lánzalo **en segundo plano** y vigila con Monitor las líneas `### …` y `{"codigo"…}`. Dos modelos de agentes distintos pueden ir a la vez (sesiones de tmux distintas: `b-CÓDIGO` y `c-CÓDIGO`).
- **Cupo gratuito de OpenRouter: 50 peticiones al día por clave.** Una sesión de agente gasta de 2 a 25. `benchmark.sh` para si el cupo está a 0. Si un prompt se corta por 429 a medias, la prueba no vale: muévela a `_descartados/<modelo>-limite-diario/` con un `motivo.txt` y repítela cuando haya cupo. Lo hecho no se repite (se salta lo que tiene `meta.json`).

### OpenCode 2 con OpenRouter y Ollama Cloud: cortes, proveedores y reintentos

**Instalar.** OpenCode 2.x no está en npm (`opencode-ai` acaba en 1.x). En Linux: `curl -fsSL https://opencode.ai/v2/install -o i.sh && VERSION=2.3.0 bash i.sh --no-modify-path` y copia `~/.opencode/bin/opencode` a `/usr/local/bin/`: el encierro tapa `/root` y no lo vería. `lanzar.sh` ya quita sus topes de tiempo (`timeout`, `headerTimeout`, `chunkTimeout`).

**Antes de lanzar un modelo de OpenRouter**, mira sus proveedores y precios y prueba que responde por el que vas a usar:
```bash
curl -s https://openrouter.ai/api/v1/models/<id>/endpoints        # tag, max_completion_tokens, precio
curl -s https://openrouter.ai/api/v1/credits -H "Authorization: Bearer $OPEN_ROUTER_API_KEY"   # crédito total y usado
```
Calcula el gasto con lo que costó un modelo parecido (`meta.json → coste_usd`) y avisa al autor si el crédito va justo.

**Variables de `lanzar.sh` / `benchmark.sh`** (se apuntan en `meta.json → limites` y van en las rarezas del juicio):
- `PROVEEDOR_OR=<slug>` fija el proveedor de OpenRouter sin respaldo. Va en `options.extraBody.provider` del `opencode.json` del modelo: en `options.provider` OpenCode 2.x **no lo manda**. Para comprobar que llega, prueba un proveedor inexistente: OpenRouter tiene que rechazar la petición.
- `SALIDA_MAX=<n>` rebaja el tope de salida (`min(límite real, n)`).

**Modelos de Google (`google/*`)**: lánzalos así desde el principio:
```bash
SALIDA_MAX=65536 PROVEEDOR_OR=google-ai-studio scripts/benchmark.sh google/gemini-4-xxx
```
- Por defecto OpenRouter va a **Google Vertex**, que corta con `502 Network connection lost` (`provider_unavailable`) cuando el modelo razona más de ~5 min.
- En AI Studio, un tope de salida mayor de 65 536 lleva la petición al nivel **«flex»** (mitad de precio, mucho más lento) y también se corta. Con `SALIDA_MAX=65536` va al nivel estándar, que es el límite real de ese endpoint y sobra para cualquier prompt (A3D ≈ 26 000 tokens). El nivel se ve por el precio: `cost / completion_tokens` ≈ precio estándar o la mitad.
- Aun así, un modelo que piensa mucho (gemini-4-neon con el sistema de OpenCode: ~23 000 caracteres y 13 herramientas) puede pasar de ~6 min en una petición y cortarse. Ver «Reintentos».

**Saldo de OpenRouter**: cada petición reserva `max_tokens × precio de salida` y OpenRouter la rechaza con un 402 («requires more credits, or fewer max_tokens») si no cabe en el saldo, aunque luego fuera a gastar mucho menos (65 536 × 15 $/M ≈ 0,98 $). Una sesión puede quedarse a medias por eso: es un límite nuestro, va a `_descartados/<modelo>-sin-credito/`. Con poco saldo, un PTS cabe con `SALIDA_MAX=32768`; para A3D, AIF o CCA hace falta crédito.

**Ollama Cloud** no manda nada mientras el modelo genera una llamada a herramienta (un `write` grande): si pasan ~5 min sin bytes, corta con `ECONNRESET` o `504 Gateway Timeout`. Les pasa a los modelos lentos (mistral-large-4). OpenCode reintenta solo.

**Reintentos: cuándo vale la prueba y cuándo no.**
- «Retry due · attempt N» es OpenCode reintentando la misma petición: no es repetir la prueba. Si la sesión **termina** (escribe lo suyo y da su respuesta final), la prueba vale; apunta los cortes como rareza. `meta.json → error` puede quedarse con el último error aunque la sesión acabara bien: mira `respuesta.md` y la sesión.
- Las peticiones cortadas no se cobran (`/api/v1/generation?id=gen-…` → `total_cost: 0`), así que dejar reintentar solo cuesta tiempo.
- Si encadena **tres cortes seguidos** en la misma petición, o la sesión muere sin `meta.json`, es un fallo técnico: para (mata `benchmark.sh`, `lanzar.sh` y **solo** su sesión de tmux), mueve lo que haya a `_descartados/<modelo>-<motivo>/` con `motivo.txt`, apúntalo en `_descartados/README.md` y relanza con el arreglo. Lo ya hecho no se repite.
- Vigila con un Monitor que avise del `{"codigo"…}` de cada prompt y de N cortes seguidos (no de cada línea «Retry»: se repite en pantalla y llena el chat). No acabes el pipeline en `uniq`: se guarda la última línea hasta que llega otra distinta y el aviso no sale nunca; compara con la línea anterior dentro del bucle.

**Diagnosticar un corte**, en este orden:
1. El error exacto: `~/.opencode-bench/<modelo>/data/opencode/opencode.db`, tabla `session_message` (campos `finish`, `time.created/completed`, `error.message`, `error.response.body` con el `gen-…` y el proveedor).
2. Lo que dice OpenRouter de esa petición: `curl -s "https://openrouter.ai/api/v1/generation?id=gen-…" -H "Authorization: Bearer $OPEN_ROUTER_API_KEY"` (`provider_name`, `generation_time`, `tokens_completion`, `total_cost`).
3. Reprodúcelo con curl, sin OpenCode: el prompt tal cual más una herramienta `write`, `"stream": true`, el mismo proveedor y tope, y anota los segundos de cada línea (`while read l; do echo "$(( $(date +%s)-t0 )) ${l:0:120}"; done`). Si curl acaba bien y OpenCode no, compara las peticiones.
4. Qué manda OpenCode de verdad: copia su `opencode.json` a un `XDG_CONFIG_HOME` temporal con `baseURL` a un servidor local que apunte el cuerpo y devuelva 500 (`NO_PROXY=127.0.0.1`), y lanza `opencode run --standalone "hola"`. Así se vio que manda `max_completion_tokens`, `extraBody` y ningún parámetro de razonamiento.
5. El proxy del contenedor deja pasar conexiones largas (una de Ollama aguantó 943 s): un corte a los 5-6 min viene del proveedor o de OpenRouter.

**Búsqueda web en OpenCode 2**: la primera `websearch` abre un diálogo de permiso; el lanzador lo cierra como una pregunta («Decide tú.», cuenta en `veces_decide_tu`) y esa búsqueda queda «cancelled». Si el modelo vuelve a intentarlo, pasa. Unos lo reintentan o usan `webfetch` y otros siguen de memoria: apúntalo en las rarezas de AIF, porque cambia el contenido de Web Reactiva.

**No cambies el modelo para que pase**: ni bajar el razonamiento, ni otro prompt, ni otro modelo. Se cambia la ruta (proveedor, nivel) y se anota.

**Cuidado al limpiar**: no borres carpetas de `/var/tmp/bench/` ni sesiones de tmux de otro modelo que esté corriendo; una carpeta vacía puede ser la de una prueba en marcha.


### Lo aprendido con SEC y TCI (24 nov. 2026)

**Subagentes: cuéntalos.** Los modelos lanzan subagentes (OpenCode: herramienta `subagent`; Claude Code: `Agent`) y su gasto no sale en la sesión principal. Kimi-K3.1-pro en TCI apuntaba 252 k tokens y gastó 2,4 M; en SEC, 3,7 M frente a 8,7 M reales. `lanzar.sh` lo suma con `scripts/tokens-subagentes.py` (sesiones hijas en `~/.opencode-bench/<modelo>/data/opencode/opencode.db`) y `lanzar-claude.sh` copia `<sesión>/subagents/agent-*.jsonl` a `subagentes/`, que suma `tokens-claude.py`. Lo sumado queda en `meta.json → subagentes`. En TCI cambia la nota (eficiencia): Inkling-2-small bajó de 7 a 6. Si un resultado viejo no lo tiene, pásale `tokens-subagentes.py` y vuelve a puntuar.

**Subagentes en segundo plano: espera.** Si el modelo cierra su turno esperando a sus subagentes, los dos lanzadores esperan mientras la pantalla los muestre (Claude Code: «Waiting for N background agents»; OpenCode: «↓ N subagents» en la barra de estado). Antes se cerraba la sesión sin resultado (Haiku en SEC, Inkling-2-small en TCI, en `_descartados`).

**Prompt sin enviar.** A veces el Enter llega antes de que OpenCode acepte la entrada: el prompt se queda escrito en la caja, con la portada en pantalla, y la prueba sale con 0 peticiones (MiniMax-m3.1-flash y Mistral-large-4 en SEC). `lanzar.sh` vuelve a pulsar Enter si la portada sigue ahí. Si ves 0 peticiones y `sesion` vacía, es esto: a `_descartados` y se repite.

**Ollama Cloud y su límite de uso.** Uno detrás de otro, nunca a la vez. TCI antes que SEC: TCI gasta 1-2 M de tokens por modelo y un SEC puede pasar de 5 M. **Kimi-K3.1-pro, siempre el último**: es el que más gasta y su cuenta es cara. `benchmark.sh` se para al primer «usage limit» (sale con 3); lo cortado va a `_descartados/<modelo>-<CÓDIGO>-limite-ollama` y se repite en la siguiente ventana de cupo. Antes de lanzar, comprueba que hay cupo con una petición pequeña a `https://ollama.com/v1/chat/completions`.

**No edites un lanzador mientras corre.** Bash lee el script a trozos: si cambias `lanzar.sh`, `lanzar-claude.sh` o `benchmark.sh` con una prueba en marcha, al volver ejecuta texto desplazado. Prepara la versión nueva en el scratchpad y cópiala cuando no haya ninguno corriendo (`pgrep -f "scripts/lanzar.sh "`). Para reordenar una cola sin perder la prueba en curso, mata solo `benchmark.sh` (el padre): el `lanzar.sh` en marcha termina y guarda; luego lanza la cola nueva, que se salta lo ya hecho.

**Casos que decidió el autor** (no los generalices sin preguntar):
- Kimi-K3.1-pro en SEC, cortado por el límite en una segunda pasada con el informe ya escrito: se juzga tal cual.
- Kimi-K3.1-pro en TCI, cortado con 7 de 10 bloques: se juzga lo que hizo (sus bloques juntados) con el coste real, y se da por bueno. No se escribe que sea parcial ni proyectado.
- Un modelo que falla por sí mismo sin error de la API (Beam en SEC: llamada a herramienta mal formada dentro del razonamiento, sin informe) no se repite; la rúbrica da 0 y el autor le puso un 1 (leyó el proyecto y apuntó fallos reales en su razonamiento).

- Gemini por OpenRouter (24 nov. 2026), decisiones del autor por coste: carbon en TCI dejó la clasificación sin escribir (11 `MALFORMED_FUNCTION_CALL` seguidas) y lleva un 6, con la calidad de hydrogen y la eficiencia de su gasto real; neon no hizo SEC (en TCI gastó 5,13 $ con seis subagentes) y hereda un 7, el 8 de los otros Gemini con un punto menos porque en las pruebas comunes queda por debajo. Su `SEC/meta.json` lleva `sin_ejecutar` y el juicio lo advierte. Los modelos de Google en OpenRouter gastan mucho: comprueba el saldo antes y empieza por el más barato.

**Coste en TCI.** OpenCode apunta 0 $ en los modelos de Ollama (suscripción): `puntuar.py` lo ignora y estima con `scripts/tci/precios.json` (precio del mismo modelo en OpenRouter, con la fuente). Un modelo nuevo necesita su línea ahí antes de puntuar.

## 2. Validar (en una copia)

Primero: ¿existe lo que dice que ha hecho? Compara `respuesta.md` con `meta.json → ficheros`.

| Código | Qué se comprueba |
|---|---|
| A3D, AIF | `node scripts/validar.mjs <dir>`: errores de consola y captura. Luego usarlo con Playwright: en A3D, arrancar el tour y capturar a los ~10 s y en una parada intermedia; en AIF, combinar dos pares obvios (HTML + CSS…) y calcular cuántas recetas se pueden alcanzar desde los elementos base (`juez/alcanzables.js` de nemotron sirve de modelo). |
| CCA | En `/tmp`: instalar, compilar, sus tests y su ejemplo. Después un script del juez con las mismas pruebas para todos: 50 altas concurrentes sobre el mismo carrito, monedas mezcladas, 0,10 × 3, id con `../`, si el objeto devuelto se puede mutar. Ver `CCA/juez/` de los modelos ya hechos. |
| SEC | Lee el informe entero y cruza **cada** hallazgo con `scripts/sec/ground-truth.json` en `juez/hallazgos.json` (formato en `scripts/sec/puntuar.py`; ejemplo en `resultados/anthropic_claude-haiku-5-5/SEC/juez/`). Acierto estricto: mismo fichero, línea en el rango ±10 (o sin línea) y clase equivalente a un CWE de `acceptable_cwes`; un hallazgo cubre una entrada por ubicación citada. Lo que no acierta es FP aunque sea real: compruébalo en el código y márcalo `EXTRA` (real) o `FP` (inventado). Las rutas son las de la copia (`~/.cache/benchmark-semillas/SEC/semilla`; mismas líneas que el original). Después `python3 scripts/sec/puntuar.py resultados/<modelo>/SEC` y copia `rubrica` y `nota` al juicio. Mira `cambios.txt` (si tocó código) y si nombra el proyecto original (OopsSec, RealVuln). |
| TCI | `python3 scripts/tci/puntuar.py resultados/<modelo>/TCI`: compara `salida/clasificacion.jsonl` (cualquier estructura de JSON) con la clasificación de jev, cuenta tiempo, peticiones y tokens, y da la rúbrica y la nota. Mira en la sesión cómo leyó las incidencias (enteras, resumidas, con un script) y si añadió campos: son las rarezas. El coste en dólares se estima con los precios de la API y va como información. |

En el contenedor sin GPU, Chromium dibuja WebGL por software (`--use-gl=swiftshader`) a ~1 fps: en A3D, las escenas que avanzan con `dt` limitado (p. ej. `Math.min(dt, 0.05)`) van hasta 15 veces más lentas. Mide los fps antes de decir que «el tour no avanza» y espera a que acabe el vuelo de cámara antes de capturar una parada (ver `google_gemini-4-carbon/A3D/juez/`). En AIF, combina con la mesa limpia y solo las dos fichas: si se amontonan, la detección por «ficha más cercana» puede acertar a otra.

Los scripts del juez en `.mjs` cargan Playwright con `createRequire(import.meta.url)('playwright')` y `NODE_PATH=$(npm root -g)`; escríbelos con Write, no con un heredoc en Bash.

En `validacion.json` añade `extra` con líneas cortas (`✔ …`, `✖ …`, `~ …`) y `capturas_extra` si hiciste más capturas: el índice las enseña.

## 3. Juzgar

Revisa la sesión (`sesion.json` en OpenCode, `sesion.jsonl` en Claude Code): herramientas usadas, si probó lo que hizo, si tocó tests para que pasaran, errores, lo que dice en el chat frente a lo que hay en disco.

Escribe en cada `resultados/<modelo>/<CÓDIGO>/`:

- `juicio.json`: `rubrica` (puntos de cada criterio de `rubricas.md`), `nota` (su suma; añade el modelo a `scripts/aplicar-rubrica.py` o pon el desglose a mano), `veredicto` (tres o cuatro palabras), `resumen` (dos frases) y `rarezas` (lista).
- `juicio.md`: `# CÓDIGO · modelo · N/10`, veredicto en negrita, y las secciones Validación, Lo que está bien, Lo que falta o está mal, Rarezas de la sesión.

Vara de medir, igual para todos: compara con lo ya juzgado en el mismo prompt para que las notas sean coherentes. Una rareza es lo que sorprende de la sesión, no un fallo del resultado: gasto desproporcionado, ajustar tests al código, presumir de lo que no hay, comprobarse a sí mismo, idioma cambiado, ficheros sobrantes. Escribe en español, sin muletillas ni frases hechas.

## 4. Cerrar

```bash
python3 scripts/indice.py && python3 scripts/estado.py   # index.html, resultados.json y el README.md de cada modelo (tabla + rarezas)
grep -rl "sk-or-" benchmark            # ninguna clave en el repo
```

Actualiza «Estado» en `README.md`, haz commit y push. Al autor, en el chat: la tabla del modelo (peticiones, tokens, nota, veredicto) y las rarezas que más llamen la atención.

Para llevar los resultados al repositorio público, `/exportar-benchmark`.
