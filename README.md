# Benchmark de modelos

Pruebas propias de prompts contra modelos (empezando por los gratuitos de OpenRouter), al estilo del pelícano en bicicleta de Simon Willison. Para la sección de modelos de Web Reactiva.

Abre `index.html` para ver la tabla: tokens, peticiones, validación, nota del juez y captura de cada prueba.

## Reglas

- **El prompt es el que es.** Está en `prompts/<CÓDIGO>.txt` y no se toca. Solo se le añade `prompts/_destino.txt` (dónde guardar lo que genere).
- **SEC empieza con un proyecto.** Es el único prompt que no arranca en una carpeta vacía: el agente recibe en ella una tienda Next.js anonimizada (`scripts/semilla.sh` la prepara con `scripts/sec/preparar.py`; detalle en `scripts/sec/README.md`), y corre sin búsqueda ni descarga web para que no busque el proyecto original. `salida/` guarda solo lo que creó o cambió (`cambios.txt`).
- **Un mensaje por sesión.** Sesión nueva para cada prompt y nada de pedir correcciones después. Lo que salga es el resultado. Si el modelo pregunta, da opciones o pide que elijamos, se le contesta «Decide tú.» cada vez: decide siempre el modelo.
- **Sin topes.** Cada modelo corre con el contexto y la salida máxima reales de su proveedor (`scripts/limites.py`); quedan en su `meta.json`.
- **Aislado.** OpenCode corre con su propia configuración, su propio `HOME` y en una carpeta vacía fuera del repo: no lee `AGENTS.md`, ni skills, ni la configuración de nadie.
  - **Excepción macOS.** En macOS no hay `unshare`, así que el agente no va dentro de `scripts/encierro.sh`: el entorno es el que es. Conserva su configuración y `HOME` propios y la carpeta aleatoria en `/var/tmp/bench/`, y se encierra con el sandbox del propio agente si lo tiene. Codex usa un perfil de permisos mínimo: lee y escribe solo su carpeta y su `HOME`, lee las herramientas del sistema (Homebrew, Command Line Tools, node) y tiene red; no ve `/Users`. Así no puede usar navegadores instalados en el equipo. Las tandas anteriores fueron más abiertas: GPT-6.2-Sol (medium) con `workspace-write`, que le dejaba leer el disco y escribir en `/tmp`, y GPT-6.2-Astra (default) leyendo el disco salvo el repo y las configuraciones (`meta.json → aislamiento`). Queda en `meta.json → aislamiento` y `scripts/fugas.py` revisa la sesión igual.
- **Una tirada.** Solo se repite una prueba por un fallo técnico (error de la API, desconexión, sesión que no responde, un límite nuestro); un mal resultado no se repite nunca.
- **Nota con rúbrica.** Cada prompt se puntúa sobre 10 con los criterios de `rubricas.md`; el desglose va en `juicio.json → rubrica`.
- **El juez solo mira.** Comprueba que existe lo que el modelo dice que ha hecho, lo valida (abrirlo, compilarlo, pasar sus tests en una copia) y lo puntúa. No lo arregla.

| Código | Tipo | Prompt | Qué mide | Etiqueta |
|---|---|---|---|---|
| A3D | visual | Una ruta en 3D en la Alhambra de Granada en un solo fichero html | Convertir conocimiento del mundo en un entregable visual que funciona sin verlo: escena, cámara y recorrido a ciegas | Visual |
| AIF | visual | Haz un juego de alquimia como Infinite Craft de neal.fun, pero con el contenido de Web Reactiva. Un único archivo HTML. | Diseñar un producto interactivo coherente: una mecánica y cientos de recetas que encajan, con contenido de un nicho concreto | Producto |
| CCA | código | Implementa un carrito de la compra escalable | Ejecutar más que razonar: convertir algo vago («escalable») en decisiones concretas y demostrar con tests que funcionan | Ejecución |
| SEC | seguridad | Haz una auditoría de seguridad de este proyecto | Leer y entender código ajeno a escala: seguir datos entre ficheros y señalar cada fallo con fichero, línea y CWE, sin escribir código | Análisis |
| TCI | clasificación | Clasifica las incidencias de incidencias.jsonl (tipo, superficie y áreas de 300 incidencias de Codex) | Hacer bien y barata una tarea acotada y repetitiva: la calidad se compara con un modelo de decisión y la eficiencia cuenta aparte | Volumen |

Las cinco pruebas cubren dos ejes. **Crear o analizar:** A3D, AIF y CCA crean; SEC y TCI analizan. **Tamaño de la tarea:** un entregable de una vez (A3D, AIF), un proyecto con pruebas (CCA), un repositorio entero que leer (SEC) y cientos de piezas pequeñas (TCI). La tabla «Para qué destaca cada modelo», al final, da a cada modelo la etiqueta de cada prueba en la que saca 9 o más. No es una recomendación cerrada: es una tirada por prueba, A3D y AIF dependen en parte del juez (SEC y TCI se corrigen solas) y un mismo modelo puede rendir distinto en otro agente.

## Cómo se lanza

```bash
scripts/lanzar.sh CCA ollama/kimi-k3.1-pro                       # una prueba
node scripts/validar.mjs resultados/<modelo>/A3D      # HTML: errores y captura
python3 scripts/indice.py && python3 scripts/estado.py  # rehace index.html, resultados.json, los README y esta tabla
```

Necesita `OPEN_ROUTER_API_KEY`, `opencode-ai` y tmux. La clave gratuita da 50 peticiones al día a modelos `:free`, y una sesión de agente gasta varias (una por cada vuelta de herramientas). Cuando se acaban, se para y se sigue otro día: `lanzar.sh` no repite lo que ya tiene `meta.json`.

## Exportar

`python3 scripts/exportar.py DESTINO` lleva el benchmark entero (resultados de cada modelo, prompts, rúbricas, scripts, herramientas y la skill) a otra carpeta, sin `node_modules`, sin sesiones con datos privados y comprobando que no se cuela ninguna clave. Es lo que usa la skill `/exportar-benchmark` para el repositorio público `webreactiva/benchmarks`; el plan del traslado está en `HANDOFF-benchmarks.md`.

## Qué hay en cada resultado

`resultados/<modelo>/<CÓDIGO>/`: `salida/` (lo que dejó el modelo, sin tocar), `respuesta.md` (lo que dijo en el chat), `sesion.json` (exportación de OpenCode), `pantalla.txt`, `meta.json` (fecha, prompt enviado, tokens, peticiones, herramientas usadas), `validacion.json` y `capturas/`, y el veredicto del juez en `juicio.md` y `juicio.json` (nota 0-10, qué falta, rarezas de la sesión).

`resultados/_descartados/` guarda pruebas que no valen y por qué.

## Estado

SEC (auditoría de seguridad) se añadió el 23 nov. 2026 y PTS (el post sobre tests que fallan a veces) se retiró ese día: no era un benchmark interesante y costaba evaluarlo (`resultados/_retirados/PTS.md`). TCI (clasificar 300 incidencias de Codex contra un modelo de decisión, jev) se añadió el 24 nov. 2026: mide calidad y, aparte, eficiencia, para que un modelo pequeño que clasifica casi igual de bien gastando menos quede por encima. Mientras SEC y TCI no los tengan todos los modelos, la media es la de A3D, AIF y CCA.

MWP (Mermaid de la arquitectura de Wikipedia) se retiró: casi todos los modelos sacaban un 8 o un 9. Sus resultados están en `resultados/_retirados/`.

| Modelo | Agente | A3D | AIF | CCA | SEC | TCI | Media | Peticiones | Tokens |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| [claude-fable-5-2](resultados/anthropic_claude-fable-5-2/README.md) | Claude Code | 10 | 8 | 10 | 7 | 5 | **9,3** | 46 | 4,5 M |
| [google/gemini-4-carbon](resultados/google_gemini-4-carbon/README.md) | OpenCode | 9 | 10 | 9 | 8 | 6 | **9,3** | 105 | 7,6 M |
| [claude-opus-5-5 (medium)](resultados/anthropic_claude-opus-5-5-medium/README.md) | Claude Code | 9 | 8 | 10 | 5 | 8 | **9,0** | 65 | 5,7 M |
| [ollama/inkling-2-small](resultados/ollama_inkling-2-small/README.md) | OpenCode | 9 | 9 | 9 | 4 | 6 | **9,0** | 242 | 9,2 M |
| [ollama/minimax-m3.1-flash](resultados/ollama_minimax-m3.1-flash/README.md) | OpenCode | 8 | 9 | 10 | 6 | 6 | **9,0** | 429 | 35,8 M |
| [claude-haiku-5-5](resultados/anthropic_claude-haiku-5-5/README.md) | Claude Code | 8 | 9 | 9 | 6 | 9 | **8,7** | 50 | 3,9 M |
| [google/gemini-4-hydrogen](resultados/google_gemini-4-hydrogen/README.md) | OpenCode | 9 | 9 | 8 | 8 | 6 | **8,7** | 84 | 7,6 M |
| [ollama/glm-5.3](resultados/ollama_glm-5.3/README.md) | OpenCode | 8 | 10 | 8 | 6 | 6 | **8,7** | 126 | 10,8 M |
| [claude-sonnet-5-5 (medium)](resultados/anthropic_claude-sonnet-5-5-medium/README.md) | Claude Code | 9 | 7 | 9 | 4 | 8 | **8,3** | 48 | 4,6 M |
| [google/gemini-4-neon](resultados/google_gemini-4-neon/README.md) | OpenCode | 9 | 10 | 6 | – | 6 | **8,3** | 121 | 6,1 M |
| [ollama/glm-5.3-flash](resultados/ollama_glm-5.3-flash/README.md) | OpenCode | 9 | 8 | 8 | 5 | 6 | **8,3** | 99 | 5,8 M |
| [ollama/kimi-k3.1-pro](resultados/ollama_kimi-k3.1-pro/README.md) | OpenCode | 10 | 9 | 6 | 8 | 6 | **8,3** | 260 | 14,0 M |
| [ollama/muse-spark-open](resultados/ollama_muse-spark-open/README.md) | OpenCode | 7 | 8 | 9 | 2 | 5 | **8,0** | 139 | 9,4 M |
| [gpt-6.2-sol (medium)](resultados/openai_gpt-6.2-sol-medium/README.md) | Codex CLI | 10 | 8 | 5 | – | – | **7,7** | 86 | 4,4 M |
| [ollama/minimax-m3](resultados/ollama_minimax-m3/README.md) | OpenCode | 4 | 9 | 10 | 6 | 6 | **7,7** | 366 | 39,2 M |
| [ollama/deepseek-v4.1-flash](resultados/ollama_deepseek-v4.1-flash/README.md) | OpenCode | 6 | 9 | 6 | 7 | 9 | **7,0** | 136 | 10,0 M |
| [ollama/mistral-large-4](resultados/ollama_mistral-large-4/README.md) | OpenCode | 7 | 6 | 8 | 5 | 6 | **7,0** | 56 | 2,4 M |
| [gpt-6.2-astra (default)](resultados/openai_gpt-6.2-astra-default/README.md) | Codex CLI | 6 | 8 | 4 | – | – | **6,0** | 19 | 0,4 M |
| [gpt-6.2-astra (medium)](resultados/openai_gpt-6.2-astra-medium/README.md) | Codex CLI | 6 | 7 | 4 | – | – | **5,7** | 15 | 0,3 M |
| [ollama/beam](resultados/ollama_beam/README.md) | OpenCode | 7 | 5 | 4 | 1 | 6 | **5,3** | 82 | 3,6 M |
| [nvidia/nemotron-3-ultra-550b-a55b:free](resultados/nvidia_nemotron-3-ultra-550b-a55b_free/README.md) | OpenCode | 6 | 3 | 4 | – | – | **4,3** | 32 | 0,6 M |

Notas con las rúbricas de `rubricas.md`. Las pruebas que fallaron por la parte técnica (respuestas cortadas en el tope de 32 000 tokens de OpenCode, GLM compactando sin parar por nuestra configuración de límites, MiniMax preguntando antes de que existiera la regla «Decide tú.») se repitieron. Las versiones anteriores están en `resultados/_descartados/`.

Aislamiento: desde la tanda de Ollama cada prueba corre en `scripts/encierro.sh` (no ve el repo, `/tmp`, `/home`, `/mnt` ni otros procesos). `scripts/fugas.py` revisa las sesiones: antes del encierro, DeepSeek llegó a listar los ficheros de otros modelos, pero ninguna sesión leyó trabajo ajeno. GPT-6.2-Sol (Codex CLI, esfuerzo medio) corrió en macOS, sin encierro y con el sandbox de Codex (excepción macOS, arriba): listó `/tmp` y `/Applications` y usó navegadores instalados en el equipo, sin tocar nada del benchmark. Como Haiku, va con otro agente, así que sus tokens no se comparan con los de OpenCode. Sonnet 5.5 y Opus 5.5 (Claude Code, esfuerzo medio) corrieron sin `encierro.sh` (`SIN_ENCIERRO=1`): en la nube Claude Code entra con la credencial de la sesión que lo dirige, y el encierro la oculta. Conservan configuración, `HOME` y carpeta aleatoria propios; `fugas.py` no encuentra lecturas fuera de su carpeta. Opus, en CCA, sí escribió un log en `/tmp` y paró su servidor con `pkill -f`. Dos pruebas se repitieron por fallos del lanzador (un diálogo de plugins LSP y un permiso del modo auto), ver `resultados/_descartados/`.

Para lanzar otro modelo, la skill `/benchmark-modelos` o `scripts/benchmark.sh MODELO…`. `resultados/_descartados/` explica las pruebas que no cuentan.

## Para qué destaca cada modelo

Etiqueta de cada prueba en la que el modelo saca 9 o más (la rehace `scripts/estado.py`). Un guion: ninguna todavía; las pruebas sin hacer no cuentan.

<!-- etiquetas -->
| Modelo | Agente | Destaca en | Pruebas hechas |
|---|---|---|---:|
| [google/gemini-4-carbon](resultados/google_gemini-4-carbon/README.md) | OpenCode | Visual (9), Producto (10), Ejecución (9) | 5 de 5 |
| [ollama/inkling-2-small](resultados/ollama_inkling-2-small/README.md) | OpenCode | Visual (9), Producto (9), Ejecución (9) | 5 de 5 |
| [claude-haiku-5-5](resultados/anthropic_claude-haiku-5-5/README.md) | Claude Code | Producto (9), Ejecución (9), Volumen (9) | 5 de 5 |
| [claude-fable-5-2](resultados/anthropic_claude-fable-5-2/README.md) | Claude Code | Visual (10), Ejecución (10) | 5 de 5 |
| [claude-opus-5-5 (medium)](resultados/anthropic_claude-opus-5-5-medium/README.md) | Claude Code | Visual (9), Ejecución (10) | 5 de 5 |
| [ollama/minimax-m3.1-flash](resultados/ollama_minimax-m3.1-flash/README.md) | OpenCode | Producto (9), Ejecución (10) | 5 de 5 |
| [google/gemini-4-hydrogen](resultados/google_gemini-4-hydrogen/README.md) | OpenCode | Visual (9), Producto (9) | 5 de 5 |
| [claude-sonnet-5-5 (medium)](resultados/anthropic_claude-sonnet-5-5-medium/README.md) | Claude Code | Visual (9), Ejecución (9) | 5 de 5 |
| [google/gemini-4-neon](resultados/google_gemini-4-neon/README.md) | OpenCode | Visual (9), Producto (10) | 4 de 5 |
| [ollama/kimi-k3.1-pro](resultados/ollama_kimi-k3.1-pro/README.md) | OpenCode | Visual (10), Producto (9) | 5 de 5 |
| [ollama/minimax-m3](resultados/ollama_minimax-m3/README.md) | OpenCode | Producto (9), Ejecución (10) | 5 de 5 |
| [ollama/deepseek-v4.1-flash](resultados/ollama_deepseek-v4.1-flash/README.md) | OpenCode | Producto (9), Volumen (9) | 5 de 5 |
| [ollama/glm-5.3](resultados/ollama_glm-5.3/README.md) | OpenCode | Producto (10) | 5 de 5 |
| [ollama/glm-5.3-flash](resultados/ollama_glm-5.3-flash/README.md) | OpenCode | Visual (9) | 5 de 5 |
| [ollama/muse-spark-open](resultados/ollama_muse-spark-open/README.md) | OpenCode | Ejecución (9) | 5 de 5 |
| [gpt-6.2-sol (medium)](resultados/openai_gpt-6.2-sol-medium/README.md) | Codex CLI | Visual (10) | 3 de 5 |
| [ollama/mistral-large-4](resultados/ollama_mistral-large-4/README.md) | OpenCode | – | 5 de 5 |
| [gpt-6.2-astra (default)](resultados/openai_gpt-6.2-astra-default/README.md) | Codex CLI | – | 3 de 5 |
| [gpt-6.2-astra (medium)](resultados/openai_gpt-6.2-astra-medium/README.md) | Codex CLI | – | 3 de 5 |
| [ollama/beam](resultados/ollama_beam/README.md) | OpenCode | – | 5 de 5 |
| [nvidia/nemotron-3-ultra-550b-a55b:free](resultados/nvidia_nemotron-3-ultra-550b-a55b_free/README.md) | OpenCode | – | 3 de 5 |
<!-- /etiquetas -->
