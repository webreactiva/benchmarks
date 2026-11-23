# Hilo para redes (LinkedIn / X) — Tests que fallan

**Post principal (LinkedIn):**

He llegado a una conclusión incómoda después de ver suites rotas en varios proyectos: un test que falla a veces puede hacer MÁS daño que no tener ningún test. 🧵

---

**1/5** Cuando un test falla sin razón aparente, el equipo aprende a ignorarlo. Al cabo de semanas, la suite en rojo ya no significa nada. Es la "fatiga de alarmas": cuando falla de verdad, nadie reacciona. El bug ya está en producción.

**2/5** Los tests flaky hacen perder horas investigando fantasmas. "¿He roto algo yo?" La respuesta casi siempre es no. En un equipo de 10 personas, unos pocos tests inestables devoran horas semanales en investigaciones que no llevan a ninguna parte.

**3/5** Cada fallo falso erosiona la confianza en TODA la suite. Los tests solo valen si verde = "esto funciona". Cuando eso se pierde, los tests pasan de ser red de seguridad a ser ruido de fondo.

**4/5** Y lo peor: pueden OCULTAR bugs reales. Si un test falla intermitentemente desde hace meses, el día que falla por un bug grave queda camuflado entre los falsos positivos. El ruido tapa la señal.

**5/5** Mi regla: la suite debe estar verde SIEMPRE, o no es una suite, es ruido. Si un test es inestable, trátalo como bug de primera: aísla la causa (red, tiempo, estado compartido, condiciones de carrera), ejecútalo 20 veces antes de darlo por arreglado, y si no puedes estabilizarlo, ponlo en cuarentena con un issue trazable. Nunca lo ignores.

No tener tests es un problema visible. Tener tests que fallan sin motivo es un problema invisible y corrosivo: parece que tienes calidad, pero construyes sobre arena.

🔗 Artículo completo: [enlace al post]

#testing #cleancode #devops #qa #programación

---

**Versión corta para X (280 caracteres):**

Un test que falla a veces es peor que no tener test: entrena al equipo a ignorarlo, gasta horas en falsos positivos y puede ocultar bugs reales entre el ruido. Regla: la suite verde siempre, o no es suite, es ruido. 🧵👇
