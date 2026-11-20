#!/usr/bin/env python3
"""slop.py <fichero.md> [--json]

Cuenta marcas de texto generado por IA en un texto en español, con las reglas de /unslop y _comun/estilo.md.
Devuelve tamaño, cada marca con sus apariciones y una densidad: marcas por cada 100 palabras (menos es mejor).
Es un detector de patrones: el juicio de calidad lo pone quien lee, este número solo sirve para comparar textos.
"""
import json, re, sys

REGLAS = {
    # regla de unslop: (descripción, regex, peso)
    "5-atribución-vaga": ("atribuciones vagas", r"\b(como (decía|dijo) alguien|los expertos|según algunos|muchos (desarrolladores|expertos) (creen|dicen)|estudios (muestran|demuestran))\b", 2),
    "7-vocabulario": ("vocabulario de IA", r"\b(crucial(es)?|fundamental(es)?|robust[oa]s?|panorama|sumerg\w+|adentr\w+|potenci\w+|aprovech\w+|clave|esencial(es)?|vital(es)?|paradigma|ecosistema|exhaustiv\w+|meticulos\w+|integral(es)?|holístic\w+|sinergia\w*|transformador\w*|revolucion\w+|desbloque\w+|empoder\w+)\b", 1),
    "8-ser-elegante": ("formas finas de decir «es»", r"\b(se erige|sirve como|actúa como|se posiciona como|constituye|representa un[ao]?)\b", 1),
    "9-no-solo-sino": ("«no solo X, sino Y»", r"\bno (es )?(solo|solamente|sólo|únicamente)\b[^.]{0,120}?(\bsino\b|: es\b)", 2),
    "13-raya": ("rayas (—)", r"—", 1),
    "15-negritas": ("negritas", r"\*\*[^*\n]+\*\*", 0.25),
    "16-lista-con-titulo": ("listas con etiqueta en negrita y dos puntos", r"^\s*[-*]\s+\*\*[^*]+:?\*\*:?", 1),
    "18-emojis": ("emojis decorativos", r"[\U0001F300-\U0001FAFF☀-➿✅❌]", 1),
    "20-chatbot": ("frases de chatbot", r"(¡?espero que (te|os) (sirva|ayude)|¿?(tienes|alguna) (preguntas|duda)|¡claro!|(déjame|cuéntame|cuéntanos|dime)[^.\n]{0,40}comentarios|comparte (este|tu) (post|artículo|contenido))", 2),
    "23-relleno": ("muletillas", r"\b(cabe (destacar|señalar|mencionar)|es importante (destacar|señalar|recordar|tener en cuenta|mencionar)|en el mundo (actual|del desarrollo|de la programación)|sin lugar a dudas|en definitiva|en resumen|en conclusión|a fin de cuentas|hoy en día|en la era de|vale la pena (mencionar|destacar)|no es ningún secreto|seamos (honestos|sinceros))\b", 2),
    "25-cierre-genérico": ("cierres genéricos", r"\b(el futuro (es|será|parece)|al final del día|recuerda que|la próxima vez que)\b", 1),
    "pregunta-retórica": ("preguntas retóricas de enganche («¿El resultado?»)", r"¿(El resultado|La solución|La respuesta|El problema|Por qué|Te suena|Qué significa esto)\?", 1),
    "dos-puntos-efecto": ("dos puntos de efecto («El resultado: …»)", r"\b(El resultado|La clave|La respuesta|La realidad|La solución|La moraleja|El problema):", 1),
    "realidad-compleja": ("frases hechas de giro («la realidad es más compleja»)", r"\b(la realidad es (más|mucho más) (compleja|complicada)|a primera vista|pero hay un problema|aquí está el truco|spoiler)\b", 1),
    "titulo-conclusión": ("sección «Conclusión»", r"^#+\s*(Conclusi[oó]n|Conclusiones|Reflexi[oó]n final|Resumen)", 1),
}

def analiza(t):
    palabras = len(re.findall(r"\b\w+\b", t))
    lineas = t.splitlines()
    marcas, puntos = {}, 0.0
    for k, (desc, rx, peso) in REGLAS.items():
        hits = re.findall(rx, t, re.I | re.M)
        if hits:
            ej = [h if isinstance(h, str) else next(x for x in h if x) for h in hits][:6]
            marcas[k] = {"que": desc, "n": len(hits), "ejemplos": ej}
            puntos += len(hits) * peso
    frases = [f for f in re.split(r"(?<=[.!?])\s+", re.sub(r"```.*?```", "", t, flags=re.S)) if len(f.split()) > 2]
    return {
        "palabras": palabras,
        "titulos": sum(1 for l in lineas if l.startswith("#")),
        "lineas_lista": sum(1 for l in lineas if re.match(r"\s*([-*]|\d+\.)\s", l)),
        "bloques_codigo": t.count("```") // 2,
        "frase_media": round(sum(len(f.split()) for f in frases) / max(1, len(frases)), 1),
        "marcas": marcas,
        "puntos": round(puntos, 1),
        "densidad_100": round(100 * puntos / max(1, palabras), 2),
    }

if __name__ == "__main__":
    r = analiza(open(sys.argv[1], encoding="utf8").read())
    if "--json" in sys.argv:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print(f"{r['palabras']} palabras · {r['titulos']} títulos · {r['lineas_lista']} líneas de lista · "
              f"frase media {r['frase_media']} · slop {r['puntos']} ({r['densidad_100']}/100 palabras)")
        for k, m in r["marcas"].items():
            print(f"  {k:22} {m['n']:3}  {m['que']}: {', '.join(m['ejemplos'])}")
