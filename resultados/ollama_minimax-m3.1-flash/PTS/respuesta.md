I'll write a blog post about failing tests being worse than no tests. Let me check the current directory first.

---

Directorio vacío. Escribo el post.

---

Let me check for text artifacts that slipped in:

---

Varios artefactos de texto se colaron. Los corrijo:

---

Ahora aplico las correcciones:

---

Últimos ajustes de redacción:

---

Verificación final:

---

Listo. Post creado en `post-tests-que-fallan.md` (~3050 palabras, 279 líneas).

**Estructura del argumento:**

1. **La tesis desmontada** — «prefiero un test que falla a no tener tests» esconde tres supuestos inválidos, y el primero (que el fallo siempre señala un bug real) es el más caro.
2. **Distinción clave**: rojo de CI ≠ rojo documentado ≠ rojo deliberado de TDD. Solo el tercero es información; los otros dos son ruido.
3. **Cuatro costes** — normalización del fallo (alert fatigue), el test como blocker de proceso (PR, pipeline, deploy), el *test zombi* que "se arregla" invirtiendo la aserción, y la erosión del modelo mental.
4. **El caso flaky** — por qué un canal que a veces miente es peor que un canal ausente, con ejemplos de `time.sleep()` y de dependencia del reloj frente a `frozen_time` y `wait_until`.
5. **Defensa del rojo útil** — el rojo de TDD como antibiótico vs. la infección crónica; tabla comparativa.
6. **Protocolo práctico** — regla del "no me lo llevo a casa", `xfail(strict=True)` sobre `skip`, presupuesto de rojo, higiene de suite, suites `fast`/`slow`.
7. **Métrica clave**: MTTD (tiempo entre introducción del defecto y detección), en vez de cobertura de líneas.
8. **Plan de 4 fases** para salir de una suite crónicamente roja.

Incluye front matter YAML, tablas, bloques de código en Python y una conclusión que reformula la frase inicial.
