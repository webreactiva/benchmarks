---
name: benchmark-modelos
description: Lanza el benchmark propio de modelos de Web Reactiva () con uno o varios modelos, valida lo que generan y hace de juez. Cuatro prompts fijos (A3D, AIF, CCA, PTS; MWP se retiró), cada uno en una sesión nueva y aislada de OpenCode (modelos de OpenRouter) o de Claude Code (haiku, sonnet, opus), con tokens, validación, nota, veredicto y rarezas. Úsala cuando pidan «pasa el benchmark a X», «prueba este modelo con los prompts», «benchmark con haiku y gemma», «/benchmark-modelos», o quieran comparar modelos con estos prompts.
---

# Benchmark de modelos

Todo vive en este repositorio. Lee su `README.md` antes de empezar: reglas, prompts y qué hay en cada resultado.

## Reglas que no se rompen

- **El prompt es el que es.** Se manda `prompts/<CÓDIGO>.txt` tal cual más `prompts/_destino.txt` (dónde guardar). Nada más: ni aclaraciones, ni formato, ni idioma, ni «pruébalo».
- **Un mensaje por sesión.** Sesión nueva por prompt. Si pregunta, da opciones o pide que elijamos, se le contesta «Decide tú.» cada vez (el lanzador lo hace solo, hasta 5 veces); no se le pide que corrija, no se le dice que algo falla. Si se queda a medias, ese es el resultado.
- **El juez no toca la salida.** Se valida en una copia (`/tmp/...`). Los scripts del juez van en `resultados/<modelo>/<CÓDIGO>/juez/`, nunca en `salida/`.
- **Aislado.** Cada agente tiene su configuración y su `HOME`, trabaja en una carpeta con nombre aleatorio en `/var/tmp/bench/` que se borra al acabar, y corre dentro de `scripts/encierro.sh` (unshare): no ve el repo, `/tmp`, `/home`, `/mnt`, el resto de `/root` ni otros procesos. **Excepción macOS:** sin `unshare` no hay encierro; se lanza igual, con el sandbox del agente, y se apunta en `meta.json → aislamiento` (ver README). Si ve `~/.claude/skills`, un `AGENTS.md` o el trabajo de otro modelo, la prueba no vale (ver `resultados/_descartados/`). Tras cada tanda, `python3 scripts/fugas.py` lista lo que cada sesión tocó fuera de su carpeta.
- **Nada de asciinema.** tmux sí; grabar no hace falta.
- Una clave que pase el autor por el chat se usa como variable de entorno al lanzar, nunca se escribe en un fichero.

## 1. Lanzar

```bash
scripts/benchmark.sh MODELO [MODELO...]              # los cuatro prompts
scripts/benchmark.sh -p CCA,PTS MODELO               # solo algunos
```

- Con `/` va con OpenCode (`lanzar.sh`): `ollama/<id>` es de Ollama Cloud (`OLLAMA_CLOUD_API_KEY`; los ids, en `curl -s https://ollama.com/v1/models -H "Authorization: Bearer $OLLAMA_CLOUD_API_KEY"`) y el resto, de OpenRouter (`OPEN_ROUTER_API_KEY`). Los gratuitos (`:free`) se listan con `curl -s https://openrouter.ai/api/v1/models` filtrando precio 0, y conviene probar antes que responde (algunos dan 429 del proveedor).
- `haiku`, `sonnet`, `opus` o `claude-*` van con Claude Code aislado (`lanzar-claude.sh`). La carpeta sale del id real (`anthropic_claude-haiku-5-5`).
- `gpt-*` va con Codex CLI (`lanzar-codex.sh`, `codex exec`): `ESFUERZO=medium scripts/benchmark.sh gpt-6.2-sol` (`ESFUERZO=default`: el del modelo). La carpeta es `openai_<modelo>-<esfuerzo>`. Usa la cuenta de `~/.codex/auth.json` (se copia a un `CODEX_HOME` propio).
- Cada modelo tiene su configuración de OpenCode (`~/.opencode-bench/<modelo>`), así que varios modelos pueden ir a la vez, un `benchmark.sh` por modelo.
- Los límites salen de `scripts/limites.py` (contexto y salida reales del proveedor; la salida, como mucho la mitad del contexto, porque OpenCode la reserva y con salida = contexto compacta sin parar). Si `meta.json → compactaciones` es alto en una prueba corta, revisa los límites.
- Antes de los límites reales, OpenCode cortaba una respuesta en 32 000 tokens de salida si el proveedor no declara `limit` (`finish: length` en la sesión, carpeta vacía): es un 0 y se apunta como rareza.
- Si el modelo pregunta con la herramienta de preguntas, el lanzador la cierra y le contesta «Decide tú.» cada vez (`meta.json` → `veces_decide_tu`). Si pregunta en texto y se para sin hacer nada, contéstale tú «Decide tú.» en esa misma sesión.
- **Una tirada.** Solo se repite por un fallo técnico (error de la API, desconexión, sesión que no responde, un límite nuestro). La prueba fallida va a `_descartados/` con un `motivo.txt`. Un mal resultado no se repite.
- Lánzalo **en segundo plano** y vigila con Monitor las líneas `### …` y `{"codigo"…}`. Dos modelos de agentes distintos pueden ir a la vez (sesiones de tmux distintas: `b-CÓDIGO` y `c-CÓDIGO`).
- **Cupo gratuito de OpenRouter: 50 peticiones al día por clave.** Una sesión de agente gasta de 2 a 25. `benchmark.sh` para si el cupo está a 0. Si un prompt se corta por 429 a medias, la prueba no vale: muévela a `_descartados/<modelo>-limite-diario/` con un `motivo.txt` y repítela cuando haya cupo. Lo hecho no se repite (se salta lo que tiene `meta.json`).
- **OpenCode 2.x no está en npm** (`opencode-ai` acaba en 1.x). En Linux: `curl -fsSL https://opencode.ai/v2/install -o i.sh && VERSION=2.3.0 bash i.sh --no-modify-path` y copia `~/.opencode/bin/opencode` a `/usr/local/bin/`: el encierro tapa `/root` y no lo vería. `lanzar.sh` ya quita sus topes de tiempo (`timeout`, `headerTimeout`, `chunkTimeout`).
- **Modelos de Google por OpenRouter (`google/*`): fija AI Studio.** La ruta por defecto va a Google Vertex, que corta con `502 Network connection lost` (`provider_unavailable`) cuando el modelo razona más de ~5 min: en OpenCode se ve como «Retry due · Network connection lost» que se repite sin fin. Lánzalo así:
  ```bash
  PROVEEDOR_OR=google-ai-studio scripts/benchmark.sh google/gemini-4-carbon
  ```
  `PROVEEDOR_OR` va en `options.extraBody.provider` del `opencode.json` del modelo (`only`, sin respaldo). En `options.provider` OpenCode 2.x no lo manda: para comprobar que llega, pon un proveedor inexistente y OpenRouter tiene que rechazar la petición. Los proveedores de un modelo: `curl -s https://openrouter.ai/api/v1/models/<id>/endpoints`. Apunta en las rarezas del juicio por qué proveedor fue.
- **«Retry due» que se repite = fallo técnico.** Mira el error en `~/.opencode-bench/<modelo>/data/opencode/opencode.db` (tabla `session_message`, campo `error.response.body`): si es del proveedor, para la prueba (mata `benchmark.sh`, `lanzar.sh` y su sesión de tmux), llévala a `_descartados/` y reprodúcelo con curl antes de cambiar nada.
- Para saber cuánto se lleva gastado: `curl -s https://openrouter.ai/api/v1/key -H "Authorization: Bearer $OPEN_ROUTER_API_KEY"` (`usage_daily`) y `…/api/v1/credits` (crédito total y usado).

## 2. Validar (en una copia)

Primero: ¿existe lo que dice que ha hecho? Compara `respuesta.md` con `meta.json → ficheros`.

| Código | Qué se comprueba |
|---|---|
| A3D, AIF | `node scripts/validar.mjs <dir>`: errores de consola y captura. Luego usarlo con Playwright: en A3D, arrancar el tour y capturar a los ~10 s y en una parada intermedia; en AIF, combinar dos pares obvios (HTML + CSS…) y calcular cuántas recetas se pueden alcanzar desde los elementos base (`juez/alcanzables.js` de nemotron sirve de modelo). |
| CCA | En `/tmp`: instalar, compilar, sus tests y su ejemplo. Después un script del juez con las mismas pruebas para todos: 50 altas concurrentes sobre el mismo carrito, monedas mezcladas, 0,10 × 3, id con `../`, si el objeto devuelto se puede mutar. Ver `CCA/juez/` de los modelos ya hechos. |
| PTS | `python3 scripts/slop.py <post.md>`: palabras, títulos, marcas de slop y densidad. Guarda el resultado en `validacion.json` (`slop` y `extra`). Léelo entero: tesis, ejemplos, datos, inventos. |

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
