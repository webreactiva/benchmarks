# PTS · retirado el 23 nov. 2026

**Prompt:** «Escribe un post para un blog de programación sobre por qué los tests que fallan a veces son peores que no tener tests.» (`prompts/_retirados/PTS.txt`)

**Por qué se retira:** al autor no le parece un benchmark interesante y es difícil de evaluar: la nota dependía mucho del criterio del juez sobre el texto (tesis, ejemplos, «inventos») y la mayoría de los modelos sacaba entre 7 y 10. El mismo día entró SEC (auditoría de seguridad), que se puntúa contra un ground truth.

Los resultados de cada modelo siguen en `resultados/_retirados/<modelo>/PTS/` (salida, sesión, validación y juicio). `scripts/slop.py` se queda en el repositorio.

## Notas

| Modelo | Carpeta | Nota | Veredicto |
|---|---|---:|---|
| claude-fable-5-2 | `anthropic_claude-fable-5-2` | 10 | completo y limpio |
| gpt-6.2-astra | `openai_gpt-6.2-astra-medium` | 10 | el post completo |
| ollama/kimi-k3.1-pro | `ollama_kimi-k3.1-pro` | 10 | el mejor post |
| google/gemini-4-carbon | `google_gemini-4-carbon` | 9 | completo, con tics de formato |
| google/gemini-4-hydrogen | `google_gemini-4-hydrogen` | 9 | claro y útil, algo de slop |
| google/gemini-4-neon | `google_gemini-4-neon` | 9 | completo, con tics de formato |
| gpt-6.2-astra | `openai_gpt-6.2-astra-default` | 9 | afilado, con código, corto |
| ollama/glm-5.3-flash | `ollama_glm-5.3-flash` | 9 | el mejor post |
| claude-opus-5-5 | `anthropic_claude-opus-5-5-medium` | 8 | completo pero se pasa |
| claude-sonnet-5-5 | `anthropic_claude-sonnet-5-5-medium` | 8 | sólido, con la cuenta mal |
| gpt-6.2-sol | `openai_gpt-6.2-sol-medium` | 8 | limpio, centrado y corto |
| ollama/deepseek-v4.1-flash | `ollama_deepseek-v4.1-flash` | 8 | bueno, pero se desvía |
| ollama/glm-5.3 | `ollama_glm-5.3` | 8 | buen argumento, descuidado |
| ollama/inkling-2-small | `ollama_inkling-2-small` | 8 | limpio y útil, se abre de tema |
| ollama/minimax-m3 | `ollama_minimax-m3` | 8 | un ensayo, no un post |
| ollama/muse-spark-open | `ollama_muse-spark-open` | 8 | limpio y corto, se va al rojo fijo |
| ollama/beam | `ollama_beam` | 7 | esquema útil, poco post |
| ollama/minimax-m3.1-flash | `ollama_minimax-m3.1-flash` | 7 | un manual, no un post |
| ollama/mistral-large-4 | `ollama_mistral-large-4` | 7 | correcto, sin ejemplos, con extras |
| claude-haiku-5-5 | `anthropic_claude-haiku-5-5` | 6 | bien |
| nvidia/nemotron-3-ultra-550b-a55b:free | `nvidia_nemotron-3-ultra-550b-a55b_free` | 4 | cumple el mínimo |

## Rúbrica con la que se puntuó

### · Post sobre por qué los tests que fallan a veces son peores que no tener tests

Slop y extensión con `scripts/slop.py`.

| Criterio | Puntos |
|---|---:|
| Hay un post en un fichero | 1 |
| Defiende la tesis con un mecanismo (por qué es peor que no tener tests), no solo enumera males | 2 |
| Se ciñe al tema: los tests que fallan a veces | 1 |
| Ejemplos concretos: 1 por un caso; 2 si además hay código o números | 2 |
| Sin errores técnicos ni citas inventadas | 1 |
| Slop: 2 si menos de 1 marca por cada 100 palabras; 1 si entre 1 y 2; 0 si más | 2 |
| Extensión de post: entre 700 y 1800 palabras | 1 |
