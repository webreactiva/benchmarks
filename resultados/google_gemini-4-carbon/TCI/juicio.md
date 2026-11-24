# TCI · google/gemini-4-carbon · 0/10

**Sin clasificación**

## Validación

No dejó `clasificacion.jsonl`: `puntuar.py` da 0 en todo (`juez/puntuacion.json`).

Leyó las 300 incidencias y clasificó todas en su razonamiento (185 000 caracteres en una sola petición), pero al ir a escribirlas generó once llamadas a herramienta mal formadas seguidas (MALFORMED_FUNCTION_CALL de Google) y la sesión murió a los 17 min sin dejar clasificacion.jsonl. Gastó 3,8 M tokens, 40 peticiones y 1,28 $.

## Rarezas de la sesión

- Las once últimas peticiones acaban con finish_reason «error» y native_finish_reason «MALFORMED_FUNCTION_CALL» (Google AI Studio por OpenRouter): el modelo genera la llamada mal, no es un corte de red. Mismo caso que Beam en SEC: un 0 y no se repite.
- Antes hubo un ECONNRESET a los 60 s de una petición; OpenCode la reintentó y siguió.
- Leyó las incidencias con read en trozos de ~50 KB y consultó algunas sueltas con scripts de Python.
