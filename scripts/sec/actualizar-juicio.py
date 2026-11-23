#!/usr/bin/env python3
"""actualizar-juicio.py <resultados/<modelo>/SEC>

Lleva las cifras de juez/puntuacion.json (puntuar.py) a juicio.json (nota, rubrica, cifras) y a juicio.md: la nota del
título y el bloque de cifras entre <!-- cifras --> y <!-- /cifras --> (lo crea tras «## Validación» si no está).
Así el juicio no se queda con números viejos si cambia la regla o el cruce.
"""
import json, pathlib, re, sys

d = pathlib.Path(sys.argv[1])
p = json.load(open(d / "juez" / "puntuacion.json"))
j = json.load(open(d / "juicio.json"))
j["nota"], j["rubrica"] = p["nota"], p["rubrica"]
j["cifras"] = {k: p[k] for k in ("tp_estricto", "con_linea_tp", "sin_linea_tp", "fp_estricto", "fn_estricto", "f3", "wf3",
                                 "precision", "recall")} | {"juez": p["juez"]}
json.dump(j, open(d / "juicio.json", "w"), indent=2, ensure_ascii=False)

c = lambda v: f"{v:g}".replace(".", ",")
r = p["rubrica"]
bloque = f"""<!-- cifras -->
| | Nota (estricto) | Juez |
|---|---:|---:|
| Entradas cubiertas (de 40) | {c(p['tp_estricto'])} ({p['con_linea_tp']} con línea, {p['sin_linea_tp']} sin línea a medio punto) | {p['juez']['tp']} |
| F3 | {c(p['f3'])} | {c(p['juez']['f3'])} |
| wF3 | {c(p['wf3'])} | |
| Falsos positivos | {p['fp_estricto']} (incluye {p['juez']['extra_reales']} fallos reales sin etiquetar) | {p['juez']['fp_inventados']} inventados |

Rúbrica: F3 {r['f3']}/7, críticas {r['criticas']} ({len(p['criticas_estricto'])} de 6), fichero y línea {r['linea']} ({round(p['con_linea'] * 100)} % de los hallazgos), CWE {r['cwe']} ({round(p['con_cwe'] * 100)} %). **Nota: {p['nota']}/10.**
<!-- /cifras -->"""
m = (d / "juicio.md").read_text()
m = re.sub(r"^(# SEC · [^\n]*· )\d+(?:[.,]\d+)?/10", lambda x: f"{x.group(1)}{p['nota']}/10", m, count=1, flags=re.M)
if "<!-- cifras -->" in m:
    m = re.sub(r"<!-- cifras -->.*?<!-- /cifras -->", lambda _: bloque, m, flags=re.S)
else:
    i = m.index("## Validación")
    i = m.index("\n", i) + 1
    m = m[:i] + "\n" + bloque + "\n" + m[i:]
(d / "juicio.md").write_text(m)
print(f"{d}: {p['nota']}/10 · F3 {c(p['f3'])}")
