# Por qué los tests que fallan a veces son peores que no tener tests

Todos hemos visto ese test. El que pasa en tu máquina, falla en CI, vuelve a pasar si le das a "re-run", y falla otra vez el jueves por la tarde. El test flaky: el que a veces se equivoca.

La reacción instintiva es tolerarlo. "Es solo uno", "ya le echaré un ojo", "vuelve a lanzarlo y listo". Pero un test que falla a veces no es un test casi funcional: es un test que introduce un problema activo en tu equipo, y en la práctica puede ser peor que no tener cobertura alguna.

## El efecto del lobo cibernético

Una suite de tests vale exactamente lo que vale la confianza que el equipo deposita en ella. Cuando un test falla, su único mensaje es: "algo puede estar mal". No sabe distinguir entre un bug real y una carrera de Goroutines, un timeout de red o una fecha del sistema.

Si ese mensaje es falso con la suficiente frecuencia, ocurre algo inevitable: el equipo aprende a ignorarlo. Los desarrolladores empiezan a hacer skip mental de los rojos, a lanzar CI otra vez sin mirar, a aprobar PRs con builds en falta. Y ahí está la trampa, porque cuando un test **de verdad** detecta un bug real, ese bug llega disfrazado con el mismo uniforme del ruido habitual. Nadie se detiene a mirarlo.

Con cero tests, todo el mundo sabe que no hay red de seguridad y actúa en consecuencia: más cuidado al revisar, más miedo razonable a desplegar. Con una suite plagada de flaky tests, la gente cree que hay red de seguridad, pero no la hay. La falsa confianza es más peligrosa que la conciencia de riesgo.

## La suite roja se convierte en el ruido de fondo

Un pipeline permanentemente en rojo funciona como una ventana rota: normaliza el desorden. Una vez que el build rojo se convierte en el estado por defecto, cada regla del proceso se degrada un poco:

- Los PRs se mergean con builds fallando "porque ya sabrán a qué se debe".
- Las alarmas de CI dejan de notificarse o se silencian directamente.
- El nuevo desarrollador que llega aprende en su primera semana que rojo es normal.

Recuperar una suite que todos han aprendido a ignorar es mucho más difícil que construir confianza desde cero.

## Los costes ocultos, que nadie pone en el backlog

Un test flaky no cuesta solo cuando falla. Cuesta siempre:

**Tiempo de ingeniería.** Cada re-run manual es un contexto switch. Si un test flaky falla una vez de cada cincuenta y tu pipeline corre cien veces al día, alguien del equipo está interrumpido casi a diario para una nada.

**Latencia de entrega.** Los equipos suelen compensar la flakiness con retries automáticos y builds duplicados. Un pipeline de diez minutos con tres re-lanzamientos de media es un pipeline de diez minutos que entrega en media hora.

**Cuellos de botella en release.** Cuando "el build está en rojo" bloquea un despliegue, y el rojo es flaky, tienes un equipo parado esperando a que la lotería saque un número verde.

**Falsa calibración mental.** Depurar tests flaky es una de las tareas más frustrantes del oficio: el bug no se reproduce, desaparece al poner un breakpoint, y reaparece tres días después. Es tiempo de investigación sin salida.

## Un ejemplo mínimo de flakiness

No hace falta exotismo para romper una suite. Este test pasa casi siempre:

```go
func TestUsuarioSeGuarda(t *testing.T) {
    repo := NewInMemoryRepo()
    go CreateUsuario(repo, "ana")

    u, err := repo.Get("ana")
    if err != nil {
        t.Fatalf("usuario no encontrado: %v", err)
    }
    if u.Nombre != "ana" {
        t.Fatalf("nombre incorrecto: %s", u.Nombre)
    }
}
```

El `go` introduce una carrera: el test pasa si la goroutine llega a tiempo. Pasará el 99% de las veces, y ese "casi" es exactamente el problema. Cada causa común de flakiness comparte este patrón: el test depende de algo que no controla.

- **Tiempo y concurrencia:** `sleep`s, goroutines sin sincronizar, timeouts ajustados.
- **Estado compartido:** tests que dependen de una Base de datos, orden de ejecución, singletons mutables.
- **El mundo exterior:** red, filesystem, fecha y hora, zona horaria, random sin seed.
- **Dependencia del entorno:** el test solo pasa en la máquina de quien lo escribió.

## Qué hacer con ellos

La respuesta sensata no es noble, es quirúrgica:

1. **Detectarlos.** Mide la flakiness: retries en CI que registren qué test falló y pasó en el re-lanzamiento. Lo que no se mide se tolera.
2. **Ponerlos en cuarentena.** Marca el test para que no bloquee el pipeline. Un test aislado y visible es honesto; un test que rompe el build a veces, no.
3. **Reparar o eliminar.** Un test en cuarentena es una deuda con fecha de caducidad. O se arregla la causa raíz o se borra. Mantener "por si acaso" un test que miente es acumular desconfianza.
4. **No normalizar el retry como solución.** Retries automáticos pueden amortiguar picos de flakiness externa (infraestructura, red), pero como política general solo entierran el problema bajo una capa de ruido estadístico.
5. **Prevenir.** Prioriza tests deterministas: controla el tiempo con clock inyectable, usa fixtures por test, simula la red en vez de usarla, y haz explícito cualquier paralelismo.

## La regla de bolsillo

Un test debe tener una propiedad no negociable: **que haga lo que dice, siempre**. Un test verde es una promesa y un test rojo es una alerta; un test a veces verde y a veces rojo no es ni una cosa ni otra, es ruido calibrado para ahogar la señal.

Si tuvieras que elegir entre una suite con un 3% de tests flaky y una suite vacía, no es una pregunta tonta: con la suite vacía, al menos todos saben dónde están. Con la suite mentirosa, nadie sabe que están perdidos.

Dedica el mismo rigor a tus tests que a tu código de producción. Porque tus tests lo son.
