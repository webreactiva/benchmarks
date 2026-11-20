#!/usr/bin/env python3
"""aplicar-rubrica.py — guarda el desglose de la rúbrica (rubricas.md) en juicio.json y pone la nota como su suma.

Los desgloses van en PUNTOS (lo decide el juez tras comprobar cada criterio). Conserva la nota anterior en nota_previa.
"""
import json, os, re

B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRIT = {
 "A3D": ["abre sin errores", "ruta con paradas reales", "la ruta se recorre", "se reconoce la Alhambra", "vista limpia", "textos sin errores"],
 "MWP": ["compila", "en español", "camino conectado", "piezas clave", "sin errores ni inventos", "se puede leer"],
 "AIF": ["abre sin errores", "mecánica de Infinite Craft", "las combinaciones funcionan", "progresión", "«infinito»", "contenido de Web Reactiva", "acabado"],
 "CCA": ["se ejecuta", "tests en verde", "dominio completo", "dinero exacto", "precio del catálogo y validación", "concurrencia", "escala horizontal", "explica el escalado"],
 "PTS": ["hay post", "tesis con mecanismo", "se ciñe al tema", "ejemplos concretos", "sin errores ni inventos", "slop", "extensión"],
}
PUNTOS = {
 "nvidia_nemotron-3-ultra-550b-a55b_free": {
  "A3D": [0, 2, 3, 0, 0, 1], "MWP": [2, 0, 0, 1, 0, 1], "AIF": [1, 1, 0, 0, 0, 0, 1],
  "CCA": [1, 1, 1, 0, 0, 0, 1, 0], "PTS": [1, 1, 1, 0, 1, 0, 0]},
 "anthropic_claude-haiku-5-5": {
  "A3D": [1, 2, 3, 1, 0, 1], "MWP": [2, 1, 2, 2, 0, 1], "AIF": [1, 2, 2, 1, 0, 2, 1],
  "CCA": [1, 1, 1, 1, 1, 2, 1, 1], "PTS": [1, 2, 0, 1, 0, 1, 1]},
 "ollama_deepseek-v4.1-flash": {
  "A3D": [1, 2, 0, 2, 0, 1], "MWP": [2, 1, 2, 2, 1, 1], "AIF": [1, 2, 2, 1, 0, 2, 1],
  "CCA": [1, 1, 1, 1, 1, 0, 0, 1], "PTS": [1, 2, 0, 2, 1, 1, 1]},
 "ollama_glm-5.3-flash": {
  "A3D": [1, 2, 3, 2, 0, 1], "MWP": [2, 1, 2, 2, 0, 1],
  "CCA": [1, 1, 1, 1, 1, 1, 1, 1], "PTS": [1, 2, 1, 2, 0, 2, 1]},
 "ollama_minimax-m3": {
  "A3D": [1, 2, 0, 1, 0, 0], "MWP": [2, 1, 2, 2, 1, 0], "AIF": [1, 1, 2, 1, 1, 2, 1],
  "PTS": [1, 2, 1, 2, 0, 2, 0]},
}
for modelo, cods in PUNTOS.items():
    for cod, pts in cods.items():
        f = f"{B}/resultados/{modelo}/{cod}/juicio.json"
        if not os.path.exists(f):  # MWP se retiró: sus resultados están en resultados/_retirados/
            continue
        j = json.load(open(f))
        assert len(pts) == len(CRIT[cod]), (modelo, cod)
        j.setdefault("nota_previa", j["nota"])
        j["rubrica"] = dict(zip(CRIT[cod], pts))
        j["nota"] = sum(pts)
        json.dump(j, open(f, "w"), indent=2, ensure_ascii=False)
        md = f"{B}/resultados/{modelo}/{cod}/juicio.md"
        t = open(md).read()
        t = re.sub(r"^(# .*· )\d+/10", lambda m: f"{m.group(1)}{j['nota']}/10", t, count=1, flags=re.M)
        tabla = "\n## Rúbrica (rubricas.md)\n\n| Criterio | Puntos |\n|---|---:|\n" + "".join(f"| {c} | {p} |\n" for c, p in j["rubrica"].items()) + f"| **Total** | **{j['nota']}** |\n"
        t = re.sub(r"\n## Rúbrica \(rubricas.md\)\n.*?\| \*\*Total\*\* \| \*\*\d+\*\* \|\n", "", t, flags=re.S)
        partes = t.split("\n## ", 1)
        t = partes[0].rstrip() + "\n" + tabla + ("\n## " + partes[1] if len(partes) > 1 else "")
        open(md, "w").write(t)
        print(f"{modelo:42} {cod}  {j['nota_previa']:>2} → {j['nota']:>2}")
