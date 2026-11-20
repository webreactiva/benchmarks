# Benchmark de modelos

Pruebas propias de prompts contra modelos (empezando por los gratuitos de OpenRouter), al estilo del pelícano en bicicleta de Simon Willison. Para la sección de modelos de Web Reactiva.

Abre `index.html` para ver la tabla: tokens, peticiones, validación, nota del juez y captura de cada prueba.

## Reglas

- **El prompt es el que es.** Está en `prompts/<CÓDIGO>.txt` y no se toca. Solo se le añade `prompts/_destino.txt` (dónde guardar lo que genere).
- **Un mensaje por sesión.** Sesión nueva para cada prompt y nada de pedir correcciones después. Lo que salga es el resultado. Si el modelo pregunta, da opciones o pide que elijamos, se le contesta «Decide tú.» cada vez: decide siempre el modelo.
- **Sin topes.** Cada modelo corre con el contexto y la salida máxima reales de su proveedor (`scripts/limites.py`); quedan en su `meta.json`.
- **Aislado.** OpenCode corre con su propia configuración, su propio `HOME` y en una carpeta vacía fuera del repo: no lee `AGENTS.md`, ni skills, ni la configuración de nadie.
  - **Excepción macOS.** En macOS no hay `unshare`, así que el agente no va dentro de `scripts/encierro.sh`: el entorno es el que es. Conserva su configuración y `HOME` propios y la carpeta aleatoria en `/var/tmp/bench/`, y se encierra con el sandbox del propio agente si lo tiene. Codex usa un perfil de permisos mínimo: lee y escribe solo su carpeta y su `HOME`, lee las herramientas del sistema (Homebrew, Command Line Tools, node) y tiene red; no ve `/Users`. Así no puede usar navegadores instalados en el equipo. Las tandas anteriores fueron más abiertas: GPT-6.2-Sol (medium) con `workspace-write`, que le dejaba leer el disco y escribir en `/tmp`, y GPT-6.2-Astra (default) leyendo el disco salvo el repo y las configuraciones (`meta.json → aislamiento`). Queda en `meta.json → aislamiento` y `scripts/fugas.py` revisa la sesión igual.
- **Una tirada.** Solo se repite una prueba por un fallo técnico (error de la API, desconexión, sesión que no responde, un límite nuestro); un mal resultado no se repite nunca.
- **Nota con rúbrica.** Cada prompt se puntúa sobre 10 con los criterios de `rubricas.md`; el desglose va en `juicio.json → rubrica`.
- **El juez solo mira.** Comprueba que existe lo que el modelo dice que ha hecho, lo valida (abrirlo, compilarlo, pasar sus tests en una copia) y lo puntúa. No lo arregla.

| Código | Tipo | Prompt |
|---|---|---|
| A3D | visual | Una ruta en 3D en la Alhambra de Granada en un solo fichero html |
| AIF | visual | Haz un juego de alquimia como Infinite Craft de neal.fun, pero con el contenido de Web Reactiva. Un único archivo HTML. |
| CCA | código | Implementa un carrito de la compra escalable |
| PTS | texto | Escribe un post para un blog de programación sobre por qué los tests que fallan a veces son peores que no tener tests. |

## Cómo se lanza

```bash
scripts/lanzar.sh PTS ollama/kimi-k3.1-pro                       # una prueba
node scripts/validar.mjs resultados/<modelo>/A3D      # HTML: errores y captura
python3 scripts/slop.py <post.md>                               # tamaño y marcas de slop del texto
python3 scripts/indice.py && python3 scripts/estado.py  # rehace index.html, resultados.json, los README y esta tabla
```

Necesita `OPEN_ROUTER_API_KEY`, `opencode-ai` y tmux. La clave gratuita da 50 peticiones al día a modelos `:free`, y una sesión de agente gasta varias (una por cada vuelta de herramientas). Cuando se acaban, se para y se sigue otro día: `lanzar.sh` no repite lo que ya tiene `meta.json`.

## Exportar

`python3 scripts/exportar.py DESTINO` lleva el benchmark entero (resultados de cada modelo, prompts, rúbricas, scripts, herramientas y la skill) a otra carpeta, sin `node_modules`, sin sesiones con datos privados y comprobando que no se cuela ninguna clave. Es lo que usa la skill `/exportar-benchmark` para el repositorio público `webreactiva/benchmarks`; el plan del traslado está en `HANDOFF-benchmarks.md`.

## Qué hay en cada resultado

`resultados/<modelo>/<CÓDIGO>/`: `salida/` (lo que dejó el modelo, sin tocar), `respuesta.md` (lo que dijo en el chat), `sesion.json` (exportación de OpenCode), `pantalla.txt`, `meta.json` (fecha, prompt enviado, tokens, peticiones, herramientas usadas), `validacion.json` y `capturas/`, y el veredicto del juez en `juicio.md` y `juicio.json` (nota 0-10, qué falta, rarezas de la sesión).

`resultados/_descartados/` guarda pruebas que no valen y por qué.

## Estado

MWP (Mermaid de la arquitectura de Wikipedia) se retiró: casi todos los modelos sacaban un 8 o un 9. Sus resultados están en `resultados/_retirados/` y las medias son sobre los otros cuatro prompts.

| Modelo | Agente | A3D | AIF | CCA | PTS | Media | Peticiones | Tokens |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| [google/gemini-4-carbon](resultados/google_gemini-4-carbon/README.md) | OpenCode | 9 | 10 | 9 | 9 | **9,2** | 48 | 1,6 M |
| [claude-opus-5-5 (medium)](resultados/anthropic_claude-opus-5-5-medium/README.md) | Claude Code | 9 | 8 | 10 | 8 | **8,8** | 36 | 3,3 M |
| [ollama/inkling-2-small](resultados/ollama_inkling-2-small/README.md) | OpenCode | 9 | 9 | 9 | 8 | **8,8** | 82 | 3,0 M |
| [ollama/kimi-k3.1-pro](resultados/ollama_kimi-k3.1-pro/README.md) | OpenCode | 10 | 9 | 6 | 10 | **8,8** | 63 | 2,9 M |
| [ollama/glm-5.3-flash](resultados/ollama_glm-5.3-flash/README.md) | OpenCode | 9 | 8 | 8 | 9 | **8,5** | 69 | 3,2 M |
| [ollama/minimax-m3.1-flash](resultados/ollama_minimax-m3.1-flash/README.md) | OpenCode | 8 | 9 | 10 | 7 | **8,5** | 314 | 28,4 M |
| [claude-sonnet-5-5 (medium)](resultados/anthropic_claude-sonnet-5-5-medium/README.md) | Claude Code | 9 | 7 | 9 | 8 | **8,2** | 28 | 3,0 M |
| [claude-haiku-5-5](resultados/anthropic_claude-haiku-5-5/README.md) | Claude Code | 8 | 9 | 9 | 6 | **8,0** | 29 | 2,0 M |
| [ollama/muse-spark-open](resultados/ollama_muse-spark-open/README.md) | OpenCode | 7 | 8 | 9 | 8 | **8,0** | 41 | 1,1 M |
| [gpt-6.2-sol (medium)](resultados/openai_gpt-6.2-sol-medium/README.md) | Codex CLI | 10 | 8 | 5 | 8 | **7,8** | 89 | 4,4 M |
| [ollama/minimax-m3](resultados/ollama_minimax-m3/README.md) | OpenCode | 4 | 9 | 10 | 8 | **7,8** | 317 | 35,8 M |
| [ollama/deepseek-v4.1-flash](resultados/ollama_deepseek-v4.1-flash/README.md) | OpenCode | 6 | 9 | 6 | 8 | **7,2** | 94 | 6,1 M |
| [gpt-6.2-astra (default)](resultados/openai_gpt-6.2-astra-default/README.md) | Codex CLI | 6 | 8 | 4 | 9 | **6,8** | 24 | 0,5 M |
| [gpt-6.2-astra (medium)](resultados/openai_gpt-6.2-astra-medium/README.md) | Codex CLI | 6 | 7 | 4 | 10 | **6,8** | 19 | 0,4 M |
| [ollama/beam](resultados/ollama_beam/README.md) | OpenCode | 7 | 5 | 4 | 7 | **5,8** | 38 | 0,6 M |
| [nvidia/nemotron-3-ultra-550b-a55b:free](resultados/nvidia_nemotron-3-ultra-550b-a55b_free/README.md) | OpenCode | 6 | 3 | 4 | 4 | **4,2** | 34 | 0,6 M |

Notas con las rúbricas de `rubricas.md`. Las pruebas que fallaron por la parte técnica (respuestas cortadas en el tope de 32 000 tokens de OpenCode, GLM compactando sin parar por nuestra configuración de límites, MiniMax preguntando antes de que existiera la regla «Decide tú.») se repitieron. Las versiones anteriores están en `resultados/_descartados/`.

Aislamiento: desde la tanda de Ollama cada prueba corre en `scripts/encierro.sh` (no ve el repo, `/tmp`, `/home`, `/mnt` ni otros procesos). `scripts/fugas.py` revisa las sesiones: antes del encierro, DeepSeek llegó a listar los ficheros de otros modelos, pero ninguna sesión leyó trabajo ajeno. GPT-6.2-Sol (Codex CLI, esfuerzo medio) corrió en macOS, sin encierro y con el sandbox de Codex (excepción macOS, arriba): listó `/tmp` y `/Applications` y usó navegadores instalados en el equipo, sin tocar nada del benchmark. Como Haiku, va con otro agente, así que sus tokens no se comparan con los de OpenCode. Sonnet 5.5 y Opus 5.5 (Claude Code, esfuerzo medio) corrieron sin `encierro.sh` (`SIN_ENCIERRO=1`): en la nube Claude Code entra con la credencial de la sesión que lo dirige, y el encierro la oculta. Conservan configuración, `HOME` y carpeta aleatoria propios; `fugas.py` no encuentra lecturas fuera de su carpeta. Opus, en CCA, sí escribió un log en `/tmp` y paró su servidor con `pkill -f`. Dos pruebas se repitieron por fallos del lanzador (un diálogo de plugins LSP y un permiso del modo auto), ver `resultados/_descartados/`.

Para lanzar otro modelo, la skill `/benchmark-modelos` o `scripts/benchmark.sh MODELO…`. `resultados/_descartados/` explica las pruebas que no cuentan.
