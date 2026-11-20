#!/usr/bin/env python3
"""limites.py <modelo>  →  imprime JSON {"context": N, "output": N, "fuente": "..."}

Límites reales del modelo en su proveedor, para que OpenCode no le ponga topes propios.
La salida máxima no pasa de la mitad del contexto: OpenCode reserva ese hueco del contexto para la respuesta y,
si salida = contexto (GLM 5.3 Flash), cree que no le queda sitio y compacta después de cada respuesta.
  ollama/<id>   contexto de /api/show; la salida máxima no la publica Ollama, así que se pide una salida
                imposible y se lee el máximo del mensaje de error («maximum output tokens (N)»).
  otro          OpenRouter: context_length y top_provider.max_completion_tokens de /api/v1/models.
"""
import json, os, re, sys, urllib.request

m = sys.argv[1]

def pide(url, data=None, clave=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {clave}"} if clave else {})})
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")

if m.startswith("ollama/"):
    id, k = m[len("ollama/"):], os.environ["OLLAMA_CLOUD_API_KEY"]
    info = pide("https://ollama.com/api/show", {"model": id}, k).get("model_info", {})
    ctx = next((v for kk, v in info.items() if kk.endswith("context_length")), None)
    r = pide("https://ollama.com/v1/chat/completions",
             {"model": id, "messages": [{"role": "user", "content": "hola"}], "max_tokens": 10**8}, k)
    msg = json.dumps(r)
    out = int(re.search(r"maximum output tokens \((\d+)\)", msg).group(1)) if "maximum output tokens" in msg else ctx
    print(json.dumps({"context": ctx, "output": min(out, ctx // 2), "output_proveedor": out, "fuente": "ollama /api/show + error de max_tokens"}))
else:
    d = pide("https://openrouter.ai/api/v1/models")["data"]
    x = next(i for i in d if i["id"] == m)
    tp = x.get("top_provider") or {}
    ctx = x.get("context_length") or tp.get("context_length")
    out = tp.get("max_completion_tokens") or ctx
    print(json.dumps({"context": ctx, "output": min(out, ctx // 2), "output_proveedor": out, "fuente": "openrouter /api/v1/models"}))
