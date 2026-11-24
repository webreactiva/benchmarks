# SEC · google/gemini-4-neon · 7/10

**Nota heredada, sin ejecutar**

> ⚠️ **Advertencia: esta prueba no se ha hecho.** No hay informe, sesión ni cruce con el ground truth. La nota es una decisión del autor (24 nov. 2026) para no gastar más en OpenRouter.

## Por qué no se lanzó

Neon es el Gemini más caro (3 $ de entrada y 15 $ de salida por millón de tokens). En TCI gastó 5,13 $ con seis subagentes, y cada petición reserva casi 1 $ de saldo. Carbon gastó 1,34 $ en SEC y hydrogen 0,76 $: neon habría costado bastante más.

## Cómo se calcula la nota

Los otros dos Gemini sacan un 8 en SEC. En las cuatro pruebas que tienen los tres:

| | A3D | AIF | CCA | TCI | Media |
|---|---:|---:|---:|---:|---:|
| gemini-4-carbon | 9 | 10 | 9 | 6 | 8,50 |
| gemini-4-hydrogen | 9 | 9 | 8 | 6 | 8,00 |
| gemini-4-neon | 9 | 10 | 6 | 6 | 7,75 |

Neon queda por debajo de los dos, y en CCA, la otra prueba de código, saca un 6 frente a 9 y 8. Hereda el 8 con un punto menos: **7**.
