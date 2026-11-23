# Newsletter — Tests que fallan (versión email)

## Opciones de asunto (test A/B)

- **A:** El test que falla a veces es peor que no tener tests 😬
- **B:** Por qué tu suite de tests te está mintiendo (y cómo arreglarlo)
- **C:** Deja de ignorar los tests en rojo (te están costando bugs en producción)

## Texto de previsualización (preview text)

Cuando la suite falla sin motivo, el equipo aprende a ignorarla. Y ese día, el bug real ya está en producción.

---

## Cuerpo del email

Hola 👋

Hay una frase que se repite mucho en los equipos de desarrollo: «cualquier cobertura de tests es mejor que ninguna».

Durante años yo también la creí. Hasta que vi suites rotas en varios proyectos y llegué a una conclusión incómoda:

**Un test que falla a veces puede hacer más daño que no tener ningún test.**

No hablo de los tests que fallan porque el código está roto (ese es su trabajo). Hablo de esos que a veces pasan y a veces fallan sin que nadie haya tocado nada. Ese tipo de tests es tóxico:

- 🚨 **Entrenan al equipo a ignorarlos.** Si la suite está en rojo la mitad del tiempo, nadie reacciona cuando falla de verdad. El bug ya está en producción.
- ⏳ **Hacen perder horas investigando fantasmas.** «¿He roto algo yo?» La respuesta casi siempre es no.
- 🕳️ **Pueden ocultar bugs reales.** Un fallo grave queda camuflado entre los falsos positivos.
- 🧱 **Generan deuda técnica silenciosa.** Suelen ser síntoma de dependencias de red, estado compartido o condiciones de carrera que nadie ha mirado.

**Mi regla:** la suite debe estar verde siempre, o no es una suite de tests, es ruido.

Si un test es inestable (flaky), trátalo como un bug de primera categoría: aísla la causa, ejecútalo 20 veces antes de darlo por arreglado y, si no puedes estabilizarlo, ponlo en cuarentena con un issue trazable. Nunca lo ignores.

👉 **[Leer el artículo completo en el blog](https://tu-blog.dev/por-que-los-tests-que-fallan-son-peores-que-no-tener-tests)**

¿Te ha pasado alguna vez? Cuéntamelo respondiendo a este email, leo todos los mensajes 🙂

Nos leemos la semana que viene,
**El equipo del blog**

---

**P.D.** Si este email te ha resultado útil, reenvíalo a alguien de tu equipo que siga mergeando con tests en rojo. Puede que le abra los ojos 😉

*P.D.2: también puedes leer la versión en inglés del artículo [aquí](https://tu-blog.dev/why-failing-tests-are-worse-than-no-tests).*

---

## Notas de envío

- **Mejor horario:** martes o miércoles, 9:00–10:00 (hora local de la mayoría de la audiencia).
- **Segmento recomendado:** suscriptores que han abierto al menos 2 de los últimos 5 emails (audiencia engaged).
- **CTA secundario:** botón «Ver en el blog» por si el email se lee en un cliente que bloquea enlaces.
- **Plain-text alternative:** incluir siempre, muchos lectores de tech usan clientes sin HTML.
