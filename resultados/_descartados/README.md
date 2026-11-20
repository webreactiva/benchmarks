# Descartados

Pruebas que se lanzaron pero no cuentan. Se guardan como prueba de lo que pasó, no se usan en ninguna tabla.

| Carpeta | Prompts | Por qué no vale |
|---|---|---|
| `nvidia_nemotron-3-ultra-550b-a55b_free-skills-de-HOME` | MWP, PTS | OpenCode cargó las skills de `~/.claude/skills` (entre ellas `webreactiva-blog-writer`) porque el `HOME` no estaba aislado. En PTS la usó: 1621 palabras con FAQ «para GEO», 56 negritas y 10 emojis. No medía el modelo a pelo. Desde entonces los lanzadores dan a cada agente un `HOME` propio. |
| `nvidia_nemotron-3-ultra-550b-a55b_free-limite-diario` | A3D | Se cortó por el límite de 50 peticiones gratuitas al día de OpenRouter antes de escribir nada. Se repitió desde cero con otra clave. |
| `ollama_deepseek-v4.1-flash-tope-32k` | AIF | La respuesta se cortó a los 32 000 tokens de salida, el tope que OpenCode pone por defecto (`OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX`), y no guardó nada. Se repite con los límites reales del modelo, que `lanzar.sh` pide ahora al proveedor. |
| `ollama_glm-5.3-flash-tope-32k` | A3D, AIF | Lo mismo: cortadas a los 32 000 tokens de salida mientras razonaba. |
| `ollama_minimax-m3-pregunta` | CCA | Preguntó qué stack usar y entonces no se contestaba. Con la regla nueva (si pregunta, se le contesta una vez «Decide tú.») se repite. |
| `ollama_glm-5.3-flash-compactacion` | A3D, AIF | Corrieron con salida máxima = contexto: OpenCode creyó que no le quedaba sitio y compactó después de cada respuesta (14 y 36 partes de compactación). Fallo de nuestra configuración; ahora la salida no pasa de la mitad del contexto. |
| `ollama_beam-pregunta-en-texto` | CCA | Preguntó en texto qué stack usar y se paró; el lanzador solo detectaba la herramienta de preguntas y no le contestó «Decide tú.». Se repite con la detección en texto. |
| `openai_gpt-6.2-sol-medium-conector-de-la-cuenta` | PTS | Codex cargó los conectores de la cuenta de ChatGPT y tenía disponible el MCP de Web Reactiva. No lo usó, pero no corría en las mismas condiciones. Se repite con `features.apps`, `plugins` y `remote_plugin` desactivados. |
| `google_gemini-4-carbon-vertex-502` | A3D | Por la ruta por defecto de OpenRouter (Google Vertex), cada petición se cortaba con «502 Network connection lost» a los ~5 min de razonar; reproducido con curl, sin OpenCode. No dejó nada. La repetición acabó bien por la misma ruta; desde CCA se fija Google AI Studio (`PROVEEDOR_OR=google-ai-studio`). |
