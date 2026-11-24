#!/usr/bin/env python3
"""juicio.py <carpeta-resultado> < juicio.json

Escribe juicio.json y juicio.md a partir de un JSON con:
  titulo     frase del veredicto en negrita (opcional; si no, el veredicto)
  veredicto  tres o cuatro palabras
  rubrica    {criterio: puntos} en el orden de rubricas.md; la nota es la suma
  resumen    dos frases
  nota_previa, aviso (texto de cita al principio, p. ej. si es una repetición)
  secciones  {"Validación": [...], "Lo que está bien": [...], "Lo que falla": [...]}  listas de viñetas
  rarezas    [...]
  extra      líneas cortas para validacion.json → extra (✔ ✖ ~)
  capturas   rutas de capturas extra para validacion.json
"""
import json, os, sys

d = sys.argv[1]
j = json.load(sys.stdin)
meta = json.load(open(os.path.join(d, "meta.json")))
cod, modelo = meta["codigo"], meta["modelo"]
j["nota"] = sum(j["rubrica"].values())
if cod == "A3D" and j["rubrica"].get("se reconoce la Alhambra") == 0:  # tope de rubricas.md
    j["nota"] = min(j["nota"], 3)
prev = os.path.join(d, "juicio.json")
autor = (json.load(open(prev)) if os.path.exists(prev) else {}).get("autor")
if autor:  # la nota del autor manda sobre la rúbrica y sobrevive a un nuevo juicio
    j["nota_juez"], j["nota"], j["autor"] = j["nota"], autor["nota"], autor
out = {k: j[k] for k in ("nota", "nota_juez", "autor", "veredicto", "rubrica", "resumen", "rarezas") if k in j}
json.dump(out, open(os.path.join(d, "juicio.json"), "w"), indent=2, ensure_ascii=False)

md = [f"# {cod} · {modelo} · {str(j['nota']).replace('.', ',')}/10", "", f"**{j.get('titulo', j['veredicto'][0].upper() + j['veredicto'][1:] + '.')}** {j['resumen']}", ""]
if j.get("aviso"):
    md += [f"> {j['aviso']}", ""]
if autor:
    md += ["## Nota del autor", "", f"**{str(j['nota']).replace('.', ',')}/10**, nota definitiva de Daniel Primo. {autor['razon']}", "", f"La rúbrica le daba {j['nota_juez']}/10.", ""]
md += ["## Rúbrica (rubricas.md)", "", "| Criterio | Puntos |", "|---|---:|"]
md += [f"| {c} | {p} |" for c, p in j["rubrica"].items()] + [f"| **Total** | **{j.get('nota_juez', j['nota'])}** |", ""]
for titulo, items in (j.get("secciones") or {}).items():
    md += [f"## {titulo}"] + [f"- {x}" for x in items] + [""]
md += ["## Rarezas de la sesión"] + [f"- {x}" for x in j["rarezas"]] + [""]
open(os.path.join(d, "juicio.md"), "w").write("\n".join(md))

v = os.path.join(d, "validacion.json")
val = json.load(open(v)) if os.path.exists(v) else {"html": [], "mermaid": []}
if j.get("extra"):
    val["extra"] = j["extra"]
if j.get("capturas") and val.get("html"):
    val["html"][0]["capturas_extra"] = j["capturas"]
json.dump(val, open(v, "w"), indent=2, ensure_ascii=False)
print(f"{cod} · {modelo} · {j['nota']}/10")
