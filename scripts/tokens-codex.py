#!/usr/bin/env python3
"""tokens-codex.py <carpeta-resultado> <codigo> <modelo> <inicio> <prompt> <esfuerzo> <veces_decide_tu>

Como tokens-claude.py, pero lee sesion.jsonl (registro de Codex CLI). Cada petición deja un event_msg token_count
con el acumulado; se usa el último. En OpenAI input_tokens incluye la caché y output_tokens el razonamiento: se separan.
"""
import json, os, re, sys

d, cod, modelo, inicio, prompt, esfuerzo, pregunto = sys.argv[1:8]
meta = {"codigo": cod, "modelo": modelo, "agente": "Codex CLI", "esfuerzo": esfuerzo, "fecha": inicio,
        "prompt_enviado": prompt, "tokens": None, "peticiones": 0, "error": None,
        "aislamiento": "macOS sin encierro.sh: sandbox de Codex con perfil de permisos mínimo (lee y escribe solo su carpeta y su HOME, lee las herramientas del sistema, red abierta)"}
# El registro lleva el id de la cuenta de ChatGPT: fuera antes de guardar nada
f = os.path.join(d, "sesion.jsonl")
limpio = re.sub(r'account_id":"[^"]*"', 'account_id":"<oculto>"', open(f).read())
open(f, "w").write(limpio)
u, peticiones, herramientas, texto, usuario = {}, 0, {}, [], []
for l in open(os.path.join(d, "sesion.jsonl")):
    x = json.loads(l); p = x.get("payload") or {}
    t = p.get("type")
    if x["type"] == "turn_context":
        meta["esfuerzo_real"] = x["payload"].get("effort")
    if x["type"] == "event_msg" and t == "token_count" and p.get("info"):
        peticiones += 1; u = p["info"]["total_token_usage"]
    elif x["type"] == "event_msg" and t == "error":
        meta["error"] = str(p.get("message"))[:300]
    elif x["type"] == "response_item" and t == "message" and p.get("role") == "user":
        s = "".join(c.get("text", "") for c in p.get("content", [])).strip()
        if not s.startswith("<"): usuario.append(s)  # fuera environment_context y otros bloques del agente
    elif x["type"] == "response_item" and t in ("function_call", "custom_tool_call", "web_search_call", "local_shell_call"):
        n = p.get("name") or t
        herramientas[n] = herramientas.get(n, 0) + 1
    elif x["type"] == "response_item" and t == "message" and p.get("role") == "assistant":
        s = "".join(c.get("text", "") for c in p.get("content", [])).strip()
        if s: texto.append(s)
cache = u.get("cached_input_tokens", 0); razon = u.get("reasoning_output_tokens", 0)
tot = {"input": u.get("input_tokens", 0) - cache, "output": u.get("output_tokens", 0) - razon,
       "reasoning": razon, "cache_read": cache, "cache_write": u.get("cache_write_input_tokens", 0)}
tot["total"] = sum(tot.values())
meta.update(tokens=tot, peticiones=peticiones, herramientas=herramientas, mensajes_usuario=usuario,
            veces_decide_tu=int(pregunto))
salida = os.path.join(d, "salida")
meta["ficheros"] = sorted(os.path.relpath(os.path.join(r, f), salida)
                          for r, _, fs in os.walk(salida) if "node_modules" not in r for f in fs)
open(os.path.join(d, "respuesta.md"), "w").write("\n\n---\n\n".join(texto) + "\n")
json.dump(meta, open(os.path.join(d, "meta.json"), "w"), indent=2, ensure_ascii=False)
print(json.dumps({k: meta[k] for k in ("codigo", "modelo", "tokens", "peticiones", "ficheros", "error")}, ensure_ascii=False))
