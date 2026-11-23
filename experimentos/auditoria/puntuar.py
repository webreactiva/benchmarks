#!/usr/bin/env python3
"""puntuar.py <resultados/<modelo>/SEC>

Lee juez/hallazgos.json (lo rellena el juez a mano, un objeto por hallazgo del modelo) y calcula las cifras al estilo
RealVuln y la nota de rubrica.md. Escribe juez/puntuacion.json y la imprime.

hallazgos.json: {"hallazgos": [{"n": 1, "titulo": "...", "fichero": "...", "linea": 12,
                  "clase": "TP|NS|EXTRA|FP", "gt": "oss-oopssec-store-005" | null,
                  "verificable": true, "nota": "..."}],
                 "criterios": {"informe_ordenado": true}}
"""
import json, pathlib, sys

AQUI = pathlib.Path(__file__).resolve().parent
d = pathlib.Path(sys.argv[1])
gt = json.load(open(AQUI / "ground-truth.json"))["findings"]
puntuables = {f["id"] for f in gt if f.get("scoring") != "non_scoring"}
criticas = {f["id"] for f in gt if f["id"] in puntuables and f["cvss"]["severity"] == "CRITICAL"}
h = json.load(open(d / "juez" / "hallazgos.json"))
hs = h["hallazgos"]

tp_ids = [x["gt"] for x in hs if x["clase"] == "TP"]
assert len(tp_ids) == len(set(tp_ids)), "una entrada del ground truth contada dos veces"
assert set(tp_ids) <= puntuables, set(tp_ids) - puntuables
tp, fp = len(tp_ids), sum(x["clase"] == "FP" for x in hs)
extra, ns = sum(x["clase"] == "EXTRA" for x in hs), sum(x["clase"] == "NS" for x in hs)
fn = len(puntuables) - tp
recall = tp / len(puntuables)
precision = (tp + extra) / (tp + extra + fp) if tp + extra + fp else 0
f2 = 5 * precision * recall / (4 * precision + recall) if precision + recall else 0

cob = next((p for umbral, p in [(.8, 6), (.65, 5), (.5, 4), (.35, 3), (.2, 2), (.1, 1)] if recall >= umbral), 0)
crit = int(len(criticas & set(tp_ids)) >= 5)
prec = int(bool(hs) and fp / len(hs) <= 0.15)
verif = int(bool(hs) and sum(bool(x.get("verificable")) for x in hs) / len(hs) >= 0.8)
inf = int(bool(h.get("criterios", {}).get("informe_ordenado")))
rubrica = {"cobertura": cob, "criticas": crit, "precision": prec, "verificable": verif, "informe": inf}
out = {"reportados": len(hs), "tp": tp, "fn": fn, "fp": fp, "extra_reales": extra, "no_puntuables": ns,
       "recall": round(recall, 3), "precision": round(precision, 3), "f2": round(f2, 3),
       "criticas_encontradas": sorted(criticas & set(tp_ids)), "no_encontradas": sorted(puntuables - set(tp_ids)),
       "rubrica": rubrica, "nota": sum(rubrica.values())}
(d / "juez" / "puntuacion.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(out, indent=2, ensure_ascii=False))
