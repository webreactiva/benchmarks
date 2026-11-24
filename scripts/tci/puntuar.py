#!/usr/bin/env python3
"""puntuar.py <resultados/<modelo>/TCI>

Compara la clasificación del modelo (salida/clasificacion.jsonl) con la de jev-1.14.0, que se toma como correcta
(scripts/tci/correcta-jev.jsonl: tipo, superficie y áreas con probabilidad >= 0,5). Acepta la estructura que haya
elegido el modelo: nombres de campo en español o inglés, áreas como lista, texto separado por comas o diccionario
(booleanos o probabilidades, umbral 0,5), id como «codex-123», «123» o número. Escribe juez/puntuacion.json.

Medidas:
- tipo y superficie: aciertos sobre las 300 incidencias (una que falta o no se entiende, fallo).
- áreas: F1 micro (todas las áreas juntas) y macro (media por área), y Jaccard medio por incidencia.
- exactas: incidencias con tipo, superficie y áreas iguales a las de jev.
- coste: tokens y duración de la sesión (meta.json, sesion.jsonl), al lado del coste de jev (coste-jev.json), que es
  solo información: jev no compite en eficiencia.
- nota: rúbrica de rubricas.md (TCI): 6 puntos de calidad contra jev y 4 de eficiencia con umbrales absolutos.
"""
import json, pathlib, re, sys
from datetime import datetime

AQUI = pathlib.Path(__file__).resolve().parent
d = pathlib.Path(sys.argv[1])
TIPOS = ["bug", "enhancement", "documentation"]
SUPERFICIES = ["app", "CLI", "extension", "codex-web", "iOS"]
AREAS = ["windows-os", "sandbox", "app-server", "connectivity", "TUI", "session", "rate-limits", "tool-calls", "browser",
         "remote", "model-behavior", "performance", "mcp", "auth", "context", "subagent", "config", "computer-use"]
gold = {}
for l in open(AQUI / "correcta-jev.jsonl"):
    r = json.loads(l); gold[r["id"]] = r

def norma(v, opciones):
    if isinstance(v, list) and len(v) == 1:
        v = v[0]
    if not isinstance(v, str):
        return None
    s = v.strip().lower().replace("_", "-").replace(" ", "-")
    for o in opciones:
        if s == o.lower():
            return o
    for o in opciones:  # «vscode-extension», «codex cli», «bug report»…
        if o.lower() in s:
            return o
    return None

def campo(r, *claves):
    for k, v in r.items():
        kk = k.lower()
        if any(c in kk for c in claves):
            return v
    return None

def areas_de(v):
    out = set()
    if isinstance(v, str):
        v = re.split(r"[,;|]", v)
    if isinstance(v, dict):
        v = [k for k, x in v.items() if (x is True) or (isinstance(x, (int, float)) and not isinstance(x, bool) and x >= 0.5)
             or (isinstance(x, str) and x.lower() in ("true", "sí", "si", "yes"))]
    for a in v or []:
        n = norma(a, AREAS) if isinstance(a, str) else None
        if n:
            out.add(n)
    return out

def id_de(r):
    v = campo(r, "id", "number", "numero", "número")
    if v is None:
        return None
    m = re.search(r"\d+", str(v))
    return f"codex-{m.group(0)}" if m else None

# Salida del modelo: clasificacion.jsonl (o el .jsonl/.json que haya en salida/ si lo llamó de otra forma)
sal = d / "salida"
f = sal / "clasificacion.jsonl"
if not f.exists():
    cands = sorted(p for p in sal.rglob("*.json*") if "incidencias" not in p.name)
    f = cands[0] if cands else None
pred, malas = {}, 0
if f:
    texto = f.read_text()
    lineas = texto.splitlines()
    try:  # un JSON con una lista entera en vez de JSONL
        todo = json.loads(texto); lineas = [json.dumps(x) for x in (todo if isinstance(todo, list) else [todo])]
    except json.JSONDecodeError:
        pass
    for l in lineas:
        if not l.strip():
            continue
        try:
            r = json.loads(l)
        except json.JSONDecodeError:
            malas += 1; continue
        i = id_de(r)
        if i in gold and i not in pred:
            pred[i] = {"tipo": norma(campo(r, "tipo", "type", "kind"), TIPOS),
                       "superficie": norma(campo(r, "superficie", "surface", "product", "componente"), SUPERFICIES),
                       "areas": areas_de(campo(r, "area", "label", "etiqueta", "tag"))}
        else:
            malas += 1

n = len(gold)
ok_t = sum(1 for i, g in gold.items() if pred.get(i, {}).get("tipo") == g["tipo"])
ok_s = sum(1 for i, g in gold.items() if pred.get(i, {}).get("superficie") == g["superficie"])
tp = fp = fn = 0; por = {a: [0, 0, 0] for a in AREAS}; jac = 0.0; exactas = 0
for i, g in gold.items():
    ga, pa = set(g["areas"]), pred.get(i, {}).get("areas", set())
    for a in AREAS:
        por[a][0] += a in ga and a in pa; por[a][1] += a in pa and a not in ga; por[a][2] += a in ga and a not in pa
    tp += len(ga & pa); fp += len(pa - ga); fn += len(ga - pa)
    jac += 1.0 if not (ga | pa) else len(ga & pa) / len(ga | pa)
    p = pred.get(i, {})
    exactas += p.get("tipo") == g["tipo"] and p.get("superficie") == g["superficie"] and pa == ga
f1 = lambda t, a, b: 2 * t / (2 * t + a + b) if t else (1.0 if not (a or b) else 0.0)
macro = sum(f1(*v) for v in por.values()) / len(AREAS)

# Coste: tokens de meta.json; duración, del primer al último evento de la sesión
meta = json.load(open(d / "meta.json")) if (d / "meta.json").exists() else {}
dur = None
reg = d / "sesion.jsonl"
if reg.exists():
    ts = [json.loads(l).get("timestamp") for l in open(reg) if l.strip()]
    ts = [datetime.fromisoformat(t.replace("Z", "+00:00")) for t in ts if t]
    if ts:
        dur = round((max(ts) - min(ts)).total_seconds())
out = {"fichero": str(f.relative_to(d)) if f else None, "incidencias": n, "clasificadas": len(pred), "lineas_no_validas": malas,
       "tipo": round(ok_t / n, 3), "superficie": round(ok_s / n, 3),
       "areas_f1_micro": round(f1(tp, fp, fn), 3), "areas_f1_macro": round(macro, 3), "areas_jaccard": round(jac / n, 3),
       "areas_por_area": {a: {"tp": v[0], "fp": v[1], "fn": v[2], "f1": round(f1(*v), 2)} for a, v in por.items()},
       "exactas": exactas, "exactas_pct": round(exactas / n, 3),
       "coste": {"segundos": dur, "tokens": meta.get("tokens"), "peticiones": meta.get("peticiones"),
                 "herramientas": meta.get("herramientas")},
       "coste_jev": json.load(open(AQUI / "coste-jev.json"))}
# Rúbrica (rubricas.md, TCI). Calidad: contra jev. Eficiencia: umbrales absolutos; jev no entra (es un modelo de
# decisión, no un agente), y la eficiencia no se compara con él.
tok = (meta.get("tokens") or {}).get("total") or 0
# Coste estimado: el de meta.json si lo trae (OpenRouter); si no, tokens × precios.json
coste = meta.get("coste_usd")
precios = json.load(open(AQUI / "precios.json"))
modelo = (meta.get("modelo") or "").removeprefix("ollama/")
if coste is None and modelo in precios and meta.get("tokens"):
    t, pr = meta["tokens"], precios[modelo]
    coste = (t.get("input", 0) * pr["entrada"] + (t.get("output", 0) + t.get("reasoning", 0)) * pr["salida"]
             + t.get("cache_read", 0) * pr["cache_lectura"] + t.get("cache_write", 0) * pr["cache_escritura"]) / 1e6
out["coste"]["usd_estimado"] = round(coste, 3) if coste is not None else None
# Tokens o coste: un agente que relee más contexto (OpenCode) gasta más tokens; si aun así cuesta como Haiku
# (0,03 $) o poco más, se le compensa. Se toma lo mejor de las dos cuentas.
por_tokens = 2 if 0 < tok <= 600_000 else 1 if 0 < tok <= 900_000 else 0
por_coste = 0 if coste is None else 2 if coste <= 0.035 else 1 if coste <= 0.30 else 0
pet = meta.get("peticiones") or 0
rub = {
    "tipo": int(out["tipo"] >= 0.95),
    "superficie": 2 if out["superficie"] >= 0.85 else 1 if out["superficie"] >= 0.80 else 0,
    "areas": 3 if out["areas_f1_micro"] >= 0.65 else 2 if out["areas_f1_micro"] >= 0.60 else 1 if out["areas_f1_micro"] >= 0.55 else 0,
    "tokens": max(por_tokens, por_coste),
    "tiempo": int(dur is not None and dur <= 150),
    "peticiones": int(0 < pet <= 10),
}
# La eficiencia solo cuenta si la clasificación sirve (tipo >= 90 % y F1 de áreas >= 0,50): responder deprisa y barato
# no tiene mérito si no. Va por las cifras y no por los puntos de calidad, para no crear saltos de nota por décimas.
if out["tipo"] < 0.90 or out["areas_f1_micro"] < 0.50:
    rub["tokens"] = rub["tiempo"] = rub["peticiones"] = 0
out["rubrica"] = rub
out["nota"] = sum(rub.values())
out["nota_calidad"] = rub["tipo"] + rub["superficie"] + rub["areas"]
out["nota_eficiencia"] = rub["tokens"] + rub["tiempo"] + rub["peticiones"]
(d / "juez").mkdir(exist_ok=True)
(d / "juez" / "puntuacion.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({k: v for k, v in out.items() if k != "areas_por_area"}, indent=2, ensure_ascii=False))
