#!/usr/bin/env python3
"""estado.py — reescribe la tabla «## Estado» de benchmark/README.md desde resultados.json (corre indice.py antes)."""
import json, os
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDEN = ["A3D", "AIF", "CCA", "SEC", "TCI"]
# La media va sobre A3D, AIF y CCA mientras SEC y TCI (añadidos el 23 y 24 nov. 2026) no los tengan todos los modelos (PTS se retiró)
MEDIA = ["A3D", "AIF", "CCA"]
r = json.load(open(f"{B}/resultados.json")); mod = {}
for x in r:
    mod.setdefault((x["modelo"], x["agente"], os.path.dirname(x["dir"])), {})[x["codigo"]] = x
coma = lambda v, f: format(v, f).replace(".", ",")
filas = []
for (m, a, d), cs in mod.items():
    n = {c: cs[c]["juicio"]["nota"] if cs.get(c) and cs[c].get("juicio") else None for c in ORDEN}
    hechas = [n[c] for c in MEDIA if n[c] is not None]
    filas.append((sum(hechas) / len(MEDIA) if len(hechas) == len(MEDIA) else -1, m, a, d, n,
                  sum(cs[c]["peticiones"] for c in cs), sum((cs[c]["tokens"] or {}).get("total", 0) for c in cs)))
filas.sort(key=lambda f: -f[0])
t = "| Modelo | Agente | " + " | ".join(ORDEN) + " | Media | Peticiones | Tokens |\n|---|---|" + "---:|" * (len(ORDEN) + 3) + "\n"
for med, m, a, d, n, pet, tok in filas:
    t += f"| [{m}]({d}/README.md) | {a} | " + " | ".join("–" if n[c] is None else str(n[c]) for c in ORDEN)
    t += f" | **{coma(med, '.1f') if med >= 0 else 'en curso'}** | {pet} | {coma(tok / 1e6, '.1f')} M |\n"
p = f"{B}/README.md"; s = open(p).read(); i = s.index("| Modelo | Agente |", s.index("## Estado")); j = s.index("\n\n", i)
s = s[:i] + t.rstrip() + s[j:]
# Para qué destaca cada modelo: la etiqueta de cada prueba con nota >= 9
ETIQUETA = {"A3D": "Visual", "AIF": "Producto", "CCA": "Ejecución", "SEC": "Análisis", "TCI": "Volumen"}
e = "| Modelo | Agente | Destaca en | Pruebas hechas |\n|---|---|---|---:|\n"
for med, m, a, d, n, pet, tok in sorted(filas, key=lambda f: (-sum(1 for c in ORDEN if (f[4][c] or 0) >= 9), -f[0])):
    eti = [f"{ETIQUETA[c]} ({n[c]})" for c in ORDEN if n[c] is not None and n[c] >= 9]
    e += f"| [{m}]({d}/README.md) | {a} | {', '.join(eti) or '–'} | {sum(1 for c in ORDEN if n[c] is not None)} de {len(ORDEN)} |\n"
if "<!-- etiquetas -->" in s:
    i2, j2 = s.index("<!-- etiquetas -->"), s.index("<!-- /etiquetas -->")
    s = s[:i2] + "<!-- etiquetas -->\n" + e + s[j2:]
open(p, "w").write(s)
print(t)
