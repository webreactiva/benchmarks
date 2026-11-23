#!/usr/bin/env python3
"""puntuar.py <resultados-vN/<modelo>/SEC>

Lee juez/hallazgos.json (lo rellena el juez a mano, un objeto por cada hallazgo del informe) y calcula la nota con
rubrica.md: la métrica principal de RealVuln (F3, recall pesado 9:1) con su regla de cruce estricta. Escribe
juez/puntuacion.json y la imprime.

hallazgos.json:
  {"hallazgos": [{"id": "C-06", "titulo": "...", "clase": "TP|EXTRA|FP|NS", "linea": true, "cwe": false,
                  "gt": [{"id": "oss-oopssec-store-029", "estricto": true, "nota": "..."}], "nota": "..."}]}

- Un hallazgo cubre una entrada por cada ubicación que cita. «estricto» = cumple la regla de RealVuln (mismo fichero,
  línea en el rango ±10 o sin línea, y clase equivalente a un CWE de acceptable_cwes).
- Como en RealVuln, todo hallazgo que no cubre ninguna entrada de forma estricta es un falso positivo, aunque el juez
  lo haya comprobado y sea real (EXTRA): se cuenta aparte, como información, pero no salva el F3.
- linea: da fichero y línea. cwe: da un CWE.
"""
import json, pathlib, sys

AQUI = pathlib.Path(__file__).resolve().parent
d = pathlib.Path(sys.argv[1])
gt = json.load(open(AQUI / "ground-truth.json"))["findings"]
puntuables = {f["id"] for f in gt if f.get("scoring") != "non_scoring"}
cvss = {f["id"]: f["cvss"]["base_score"] for f in gt if f.get("cvss")}
criticas = {f["id"] for f in gt if f["id"] in puntuables and f.get("cvss", {}).get("severity") == "CRITICAL"}
hs = json.load(open(d / "juez" / "hallazgos.json"))["hallazgos"]

def cubre(estricto):
    ids = [g["id"] for x in hs if x["clase"] == "TP" for g in x.get("gt", []) if g.get("estricto") or not estricto]
    assert len(ids) == len(set(ids)), "una entrada del ground truth contada dos veces"
    assert set(ids) <= puntuables, set(ids) - puntuables
    return set(ids)

def f3(tp, fp, fn):
    return 10 * tp / (10 * tp + fp + 9 * fn) if tp else 0.0

tp_e, tp_j = cubre(True), cubre(False)
ns = sum(x["clase"] == "NS" for x in hs)
fp_e = sum(1 for x in hs if x["clase"] != "NS" and not any(g.get("estricto") for g in x.get("gt", [])))
fp_j = sum(x["clase"] == "FP" for x in hs)
fn_e, fn_j = len(puntuables) - len(tp_e), len(puntuables) - len(tp_j)
F3 = f3(len(tp_e), fp_e, fn_e)
# wF3 como RealVuln: aciertos y fallos pesan su CVSS; los FP, la media del ground truth (el informe no da CVSS)
media = sum(cvss[i] for i in puntuables) / len(puntuables)
wtp, wfn = sum(cvss[i] for i in tp_e), sum(cvss[i] for i in puntuables - tp_e)
wF3 = 10 * wtp / (10 * wtp + fp_e * media + 9 * wfn) if wtp else 0.0
n = len(hs) or 1

puntos = next((p for u, p in [(.8, 7), (.7, 6), (.6, 5), (.5, 4), (.4, 3), (.3, 2), (.2, 1)] if F3 >= u), 0)
rubrica = {"f3": puntos, "criticas": int(len(criticas & tp_e) >= 4),
           "linea": int(sum(bool(x.get("linea")) for x in hs) / n >= 0.9),
           "cwe": int(sum(bool(x.get("cwe")) for x in hs) / n >= 0.9)}
out = {"hallazgos": len(hs), "tp_estricto": len(tp_e), "fp_estricto": fp_e, "fn_estricto": fn_e, "no_puntuables": ns,
       "f3": round(F3 * 100, 1), "wf3": round(wF3 * 100, 1),
       "recall": round(len(tp_e) / len(puntuables), 3), "precision": round(len(tp_e) / (len(tp_e) + fp_e), 3) if tp_e else 0,
       "juez": {"tp": len(tp_j), "fp_inventados": fp_j, "extra_reales": sum(x["clase"] == "EXTRA" for x in hs),
                "f3": round(f3(len(tp_j), fp_j, fn_j) * 100, 1)},
       "con_linea": round(sum(bool(x.get("linea")) for x in hs) / n, 2), "con_cwe": round(sum(bool(x.get("cwe")) for x in hs) / n, 2),
       "criticas_estricto": sorted(criticas & tp_e), "no_encontradas": sorted(puntuables - tp_j),
       "rubrica": rubrica, "nota": sum(rubrica.values())}
(d / "juez" / "puntuacion.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(out, indent=2, ensure_ascii=False))
