# PTS · ollama/mistral-large-4 · 7/10

**Correcto, sin ejemplos, con extras.** La tesis bien explicada, sin código ni cifras, con fallos de lengua, y cuatro ficheros que nadie pidió.

## Rúbrica (rubricas.md)

| Criterio | Puntos |
|---|---:|
| hay post | 1 |
| tesis con mecanismo | 2 |
| se ciñe al tema | 1 |
| ejemplos concretos | 1 |
| sin errores ni inventos | 0 |
| slop | 1 |
| extensión | 1 |
| **Total** | **7** |

## Validación
- `slop.py` sobre `por-que-los-tests-que-fallan-son-peores-que-no-tener-tests.md`: 889 palabras, 9 títulos, 1,15 marcas por cada 100 palabras (13 negritas, «Conclusión», «Cuéntame en los comentarios»).
- En la carpeta hay cuatro ficheros más: versión en inglés, newsletter, hilo para redes y guion de vídeo (3068 palabras en total).

## Lo que está bien
- El mecanismo: fatiga de alarmas, tiempo perdido investigando fantasmas, la confianza que se erosiona y el fallo real que se camufla entre los falsos. «No tener tests es un problema visible; tener tests que fallan sin motivo es invisible y corrosivo».
- Distingue el test que falla siempre (útil) del que falla a veces, y cierra con qué hacer: aislar la causa, repetir en bucle, cuarentena con issue, bloquear el merge.

## Lo que falta o está mal
- Sin código ni números: el único ejemplo es un fallo en el cálculo de precios contado en dos líneas.
- Errores de lengua: «suites de tests rotas diente tras diente», «no Gana confianza», «determinidad».
- Cierre de blog genérico: «Cuéntame en los comentarios».

## Rarezas de la sesión
- Terminaba cada entrega preguntando «¿lo dejamos aquí o quieres algo más?». El lanzador contestó «Decide tú.» cinco veces (el máximo) y cada vez añadió otro formato: versión en inglés, hilo para redes, newsletter y guion de vídeo corto.
- En su revisión final encontró y quitó «una palabra en coreano accidental» del guion.
- 14 peticiones y 148 000 tokens.
