#!/usr/bin/env python3
"""puntuar.py <resultados/<modelo>/SEC>

Lee juez/hallazgos.json (lo rellena el juez a mano, un objeto por cada hallazgo del informe) y calcula las cifras al
estilo RealVuln y la nota de rubrica.md. Escribe juez/puntuacion.json y la imprime.

hallazgos.json:
  {"informe_ordenado": true,
   "hallazgos": [{"id": "C-06", "titulo": "...", "clase": "TP|EXTRA|FP|NS", "verificable": true,
                  "gt": [{"id": "oss-oopssec-store-029", "estricto": true, "nota": "..."}], "nota": "..."}]}

Un hallazgo que cita varias ubicaciones puede cubrir varias entradas (una por ubicación). «estricto» = cumple la regla
de RealVuln (mismo fichero y línea ±10, o sin línea); si no, el juez lo da por bueno porque señala el mismo fallo en el
mismo fichero con la línea fuera de tolerancia. La nota usa el criterio del juez; la cifra estricta va al lado.
"""
import json, pathlib, sys

AQUI = pathlib.Path(__file__).resolve().parent
d = pathlib.Path(sys.argv[1])
gt = json.load(open(AQUI / "ground-truth.json"))["findings"]
puntuables = {f["id"] for f in gt if f.get("scoring") != "non_scoring"}
criticas = {f["id"] for f in gt if f["id"] in puntuables and f["cvss"]["severity"] == "CRITICAL"}
h = json.load(open(d / "juez" / "hallazgos.json"))
hs = h["hallazgos"]

cubre = [g for x in hs if x["clase"] == "TP" for g in x.get("gt", [])]
ids = [g["id"] for g in cubre]
assert len(ids) == len(set(ids)), "una entrada del ground truth contada dos veces"
assert set(ids) <= puntuables, set(ids) - puntuables
tp_ids, tp_estr = set(ids), {g["id"] for g in cubre if g.get("estricto")}
fp = sum(x["clase"] == "FP" for x in hs)
extra = sum(x["clase"] == "EXTRA" for x in hs)
n_tp = sum(x["clase"] == "TP" for x in hs)
recall, recall_e = len(tp_ids) / len(puntuables), len(tp_estr) / len(puntuables)
precision = (n_tp + extra) / (n_tp + extra + fp) if hs else 0
f2 = lambda p, r: 5 * p * r / (4 * p + r) if p + r else 0

cob = next((p for u, p in [(.8, 6), (.65, 5), (.5, 4), (.35, 3), (.2, 2), (.1, 1)] if recall >= u), 0)
rubrica = {"cobertura": cob, "criticas": int(len(criticas & tp_ids) >= 5),
           "precision": int(bool(hs) and fp / len(hs) <= 0.15),
           "verificable": int(bool(hs) and sum(bool(x.get("verificable")) for x in hs) / len(hs) >= 0.8),
           "informe": int(bool(h.get("informe_ordenado")))}
out = {"hallazgos_reportados": len(hs), "con_entrada_gt": n_tp, "extra_reales": extra, "falsos_positivos": fp,
       "entradas_cubiertas": len(tp_ids), "entradas_cubiertas_estricto": len(tp_estr), "puntuables": len(puntuables),
       "recall": round(recall, 3), "recall_estricto": round(recall_e, 3), "precision": round(precision, 3),
       "f2": round(f2(precision, recall), 3), "f2_estricto": round(f2(precision, recall_e), 3),
       "criticas_encontradas": sorted(criticas & tp_ids), "criticas_falladas": sorted(criticas - tp_ids),
       "no_encontradas": sorted(puntuables - tp_ids), "rubrica": rubrica, "nota": sum(rubrica.values())}
(d / "juez" / "puntuacion.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(out, indent=2, ensure_ascii=False))
