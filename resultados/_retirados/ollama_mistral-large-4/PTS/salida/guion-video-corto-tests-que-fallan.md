# Guion vídeo corto — "Por qué los tests que fallan son peores que no tener tests"

**Plataformas:** Instagram Reels / TikTok / YouTube Shorts
**Duración objetivo:** 45–60 segundos
**Idioma:** Español
**Formato:** pessoa hablando a cámara (o voz en off sobre pantalla de código)

---

## Estructura del vídeo

### [0:00–0:03] HOOK (imprescindible, decides si sigues viendo)

**Texto en pantalla:** «Tu test falla... ¿y lo ignoras? Peor idea posible»

**Guion:**
> «Tienes un test que falla a veces. Lo has visto 20 veces. Lo ignoras. Error. Ese test puede ser PEOR que no tener ningún test.»

**Visual:** cara seria a cámara + corte rápido a una suite de tests en rojo.

---

### [0:03–0:15] EL PROBLEMA

**Guion:**
> «Cuando un test falla sin motivo, tu cerebro aprende una cosa: 'esto falla siempre'. Y cuando falla DE VERDAD... nadie reacciona. El bug ya está en producción.»

**Visual:** animación simple o texto superpuesto: "Falso positivo = alarma de incendios que nadie escucha".

**Texto en pantalla:** «🚨 Fatiga de alarmas en tu propio código»

---

### [0:15–0:30] LAS 3 CONSECUENCIAS

**Guion (rápido, una frase por punto):**
> «Uno: pierdes horas investigando si rompiste algo. Spoiler: no. Dos: el equipo deja de fiarse de la suite. Y tres, la peor: los bugs reales se esconden entre los falsos fallos.»

**Visual:** cada punto aparece como tarjeta de texto mientras hablas; sonido de "pop" entre ellas.

---

### [0:30–0:45] LA SOLUCIÓN

**Guion:**
> «Mi regla es simple: la suite verde SIEMPRE, o no es una suite, es ruido. ¿Test inestable? Trátalo como un bug de primera. Aísla la causa —normalmente es red, tiempo o estado compartido—, ejecútalo 20 veces y si no se estabiliza, a cuarentena con issue trazable. Nunca lo ignores.»

**Visual:** pantalla dividida mostrando código de test con `await new Promise(r => setTimeout(r, 1000))` tachado en rojo → y el mismo test con mock del timer en verde.

**Texto en pantalla:** «✅ Verde siempre, o fuera»

---

### [0:45–0:60] CTA + CIERRE

**Guion:**
> «Si en tu equipo mergeáis con tests en rojo, dejadme en comentarios cuántos bugs os ha costado. Y si queréis el artículo completo, está en el link de la bio. Nos vemos.»

**Visual:** tarjeta final (end card) con enlace al blog + botón de "Seguir".

**Texto en pantalla:**
> 📌 Artículo completo en el link de la bio
> 👇 ¿Os ha pasado? Comentad

---

## Elementos técnicos

- **Subtítulos quemados (burned-in captions):** obligatorios — el 80% ve sin sonido. Estilo: palabra por palabra, resaltada en amarillo/blanco sobre fondo oscuro semitransparente, parte inferior de la pantalla.
- **Aspect ratio:** 9:16 (vertical).
- **Miniatura (thumbnail):** cara de sorpresa + texto «PEOR que NO tener tests» en rojo/amarillo.
- **Hashtags:** #testing #programación #cleancode #devtips #flakytests #qa
- **Música:** pista de "suspense tech" a volumen bajo (-20 dB respecto a la voz), o sin música si hablas a cámara directo.
- **Hook alternativo para A/B test:** «Dejad de poner sleeps en vuestros tests 😅» (muy compartible entre devs).

## Calendario de publicación sugerido

Publicar martes o jueves entre 12:00–13:00 o 19:00–21:00 (picos de tráfico dev en redes sociales).

## Metrics a revisar a las 24h

- Retención en los primeros 3 segundos (objetivo: >65%).
- Comentarios (objetivo: >2% de las visualizaciones; el CTA de "comentad" ayudan al algoritmo).
- Shares/guardados (objetivo: >1%).
