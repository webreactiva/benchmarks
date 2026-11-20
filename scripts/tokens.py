#!/usr/bin/env python3
"""tokens.py <carpeta-resultado> <codigo> <modelo> <inicio> <prompt>

Lee sesion.json (exportación de OpenCode) y escribe meta.json y respuesta.md.
Tokens: suma de cada mensaje del asistente (una petición al modelo por mensaje).
"""
import json, os, sys


def normaliza(s):
    """OpenCode 2.x exporta {type, content[], tokens} por mensaje; lo pasa a la forma 1.x {info{role…}, parts[]}."""
    if all("info" in m for m in s.get("messages", [])):
        return s
    msgs = []
    for m in s.get("messages", []):
        if m.get("type") == "user":
            msgs.append({"info": {"role": "user"}, "parts": [{"type": "text", "text": m.get("text", "")}]})
        elif m.get("type") == "assistant":
            parts = [{"type": "tool", "tool": c.get("name"), "state": c.get("state", {})} if c.get("type") == "tool" else c
                     for c in m.get("content", [])]
            msgs.append({"info": {"role": "assistant", "tokens": m.get("tokens"), "error": m.get("error"), "finish": m.get("finish"),
                                  "cost": m.get("cost")}, "parts": parts})
    return {**s, "messages": msgs}


d, cod, modelo, inicio, prompt = sys.argv[1:6]
meta = {"codigo": cod, "modelo": modelo, "agente": "OpenCode", "fecha": inicio, "prompt_enviado": prompt,
        "tokens": None, "peticiones": 0, "error": None}
f = os.path.join(d, "sesion.json")
texto = []
if os.path.exists(f) and os.path.getsize(f):
    s = normaliza(json.load(open(f)))
    tot = {"input": 0, "output": 0, "reasoning": 0, "cache_read": 0, "cache_write": 0}
    herramientas = {}
    for m in s.get("messages", []):
        info = m.get("info", {})
        if info.get("role") == "user":
            meta.setdefault("mensajes_usuario", []).extend(p.get("text", "") for p in m.get("parts", []) if p.get("type") == "text")
        if info.get("role") != "assistant":
            continue
        meta["peticiones"] += 1
        t = info.get("tokens") or {}
        tot["input"] += t.get("input", 0); tot["output"] += t.get("output", 0)
        tot["reasoning"] += t.get("reasoning", 0)
        c = t.get("cache") or {}
        tot["cache_read"] += c.get("read", 0); tot["cache_write"] += c.get("write", 0)
        if info.get("error"):
            e = info["error"]
            meta["error"] = ((e.get("data") or {}).get("message") or e.get("name") or e.get("message")) if isinstance(e, dict) else str(e)
        for p in m.get("parts", []):
            if p.get("type") == "text" and p.get("text", "").strip():
                texto.append(p["text"].strip())
            elif p.get("type") == "tool":
                herramientas[p.get("tool")] = herramientas.get(p.get("tool"), 0) + 1
    tot["total"] = tot["input"] + tot["output"] + tot["reasoning"] + tot["cache_read"] + tot["cache_write"]
    meta["tokens"] = tot
    meta["herramientas"] = herramientas
    # Compactaciones de OpenCode: cada una mete un mensaje automático «Continue if you have next steps…»
    meta["compactaciones"] = sum(1 for m in s.get("messages", []) for p in m.get("parts", []) if p.get("type") == "compaction")
    meta["sesion"] = s.get("info", {}).get("id")
    if s.get("info", {}).get("cost") is not None:  # OpenCode 2.x: coste en dólares que da el proveedor
        meta["coste_usd"] = round(s["info"]["cost"], 4)
salida = os.path.join(d, "salida")
meta["ficheros"] = sorted(os.path.relpath(os.path.join(r, x), salida)
                          for r, _, fs in os.walk(salida) if "node_modules" not in r for x in fs) if os.path.isdir(salida) else []
open(os.path.join(d, "respuesta.md"), "w").write("\n\n---\n\n".join(texto) + "\n")
json.dump(meta, open(os.path.join(d, "meta.json"), "w"), indent=2, ensure_ascii=False)
print(json.dumps({k: meta[k] for k in ("codigo", "tokens", "peticiones", "ficheros", "error")}, ensure_ascii=False))
