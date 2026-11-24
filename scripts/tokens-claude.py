#!/usr/bin/env python3
"""tokens-claude.py <carpeta-resultado> <codigo> <modelo> <inicio> <prompt>

Como tokens.py, pero lee sesion.jsonl (registro de Claude Code). Una respuesta con varias partes se guarda en
varias líneas con el mismo id: se cuenta una vez. Claude Code no separa el razonamiento: va dentro de output.
"""
import json, os, sys

d, cod, modelo, inicio, prompt = sys.argv[1:6]
meta = {"codigo": cod, "modelo": modelo, "agente": "Claude Code", "fecha": inicio, "prompt_enviado": prompt,
        "tokens": None, "peticiones": 0, "error": None}
tot = {"input": 0, "output": 0, "reasoning": 0, "cache_read": 0, "cache_write": 0}
vistos, herramientas, texto, usuario = set(), {}, [], []
for l in open(os.path.join(d, "sesion.jsonl")):
    x = json.loads(l)
    if x.get("type") == "user" and isinstance(x.get("message", {}).get("content"), str):
        usuario.append(x["message"]["content"])
    if x.get("type") != "assistant":
        continue
    m = x["message"]
    for c in m.get("content", []):
        if c.get("type") == "text" and c["text"].strip():
            texto.append(c["text"].strip())
        elif c.get("type") == "tool_use":
            herramientas[c["name"]] = herramientas.get(c["name"], 0) + 1
    if m.get("id") in vistos or m.get("model") == "<synthetic>":
        if m.get("model") == "<synthetic>":
            meta["error"] = " ".join(c.get("text", "") for c in m.get("content", []))[:300]
        continue
    vistos.add(m.get("id"))
    u = m.get("usage", {})
    tot["input"] += u.get("input_tokens", 0); tot["output"] += u.get("output_tokens", 0)
    tot["cache_read"] += u.get("cache_read_input_tokens", 0); tot["cache_write"] += u.get("cache_creation_input_tokens", 0)
# Subagentes: sus registros van aparte (subagentes/agent-*.jsonl). Se suman sus tokens y peticiones a los de la sesión.
sub = {"sesiones": 0, "tokens": 0, "peticiones": 0}
dsub = os.path.join(d, "subagentes")
for f in sorted(os.listdir(dsub)) if os.path.isdir(dsub) else []:
    if not f.endswith(".jsonl"):
        continue
    sub["sesiones"] += 1; vs = set()
    for l in open(os.path.join(dsub, f)):
        x = json.loads(l)
        if x.get("type") != "assistant":
            continue
        m = x["message"]
        if m.get("id") in vs or m.get("model") == "<synthetic>":
            continue
        vs.add(m.get("id")); u = m.get("usage", {})
        for k, v in (("input", "input_tokens"), ("output", "output_tokens"), ("cache_read", "cache_read_input_tokens"),
                     ("cache_write", "cache_creation_input_tokens")):
            tot[k] += u.get(v, 0); sub["tokens"] += u.get(v, 0)
    sub["peticiones"] += len(vs)
tot["total"] = sum(tot.values())
meta.update(tokens=tot, peticiones=len(vistos) + sub["peticiones"], herramientas=herramientas, mensajes_usuario=usuario)
if sub["sesiones"]:
    meta["subagentes"] = sub
salida = os.path.join(d, "salida")
meta["ficheros"] = sorted(os.path.relpath(os.path.join(r, f), salida)
                          for r, _, fs in os.walk(salida) if "node_modules" not in r for f in fs)
open(os.path.join(d, "respuesta.md"), "w").write("\n\n---\n\n".join(texto) + "\n")
json.dump(meta, open(os.path.join(d, "meta.json"), "w"), indent=2, ensure_ascii=False)
print(json.dumps({k: meta[k] for k in ("codigo", "modelo", "tokens", "peticiones", "ficheros", "error")}, ensure_ascii=False))
