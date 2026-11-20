#!/usr/bin/env python3
"""fugas.py [resultados/<modelo>/<CÓDIGO> ...]

Revisa la sesión de cada prueba (sesion.json de OpenCode o sesion.jsonl de Claude Code) y lista las llamadas a
herramientas que tocan rutas fuera de su carpeta de trabajo: otras carpetas de /tmp/bench-ws o /var/tmp/bench,
el repo (/home/user), los resultados de otros modelos o el /root de quien lo dirige. Sin argumentos, revisa todas.
Una prueba que leyó el trabajo de otro modelo no vale.
"""
import glob, json, os, re, sys

B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PELIGRO = re.compile(r"(/tmp/bench-ws|/var/tmp/bench|/home/user|/Users/|cursos-y-guias|resultados/|/root/(?!\.ccr)|find /\s|ls -la /\s*;|ls (-\w+ )?/(\s|;|$))")

def llamadas(d):
    f = os.path.join(d, "sesion.json")
    if os.path.exists(f):
        s = json.load(open(f))
        for m in s.get("messages", []):
            for p in m.get("parts", m.get("content", [])):  # «content» en OpenCode 2.x
                if p.get("type") == "tool":
                    st = p.get("state", {})
                    yield p.get("tool") or p.get("name"), json.dumps(st.get("input", {}), ensure_ascii=False), str(st.get("output", st.get("content", "")))
        return
    f = os.path.join(d, "sesion.jsonl")
    if os.path.exists(f):
        for l in open(f):
            x = json.loads(l)
            p = x.get("payload") or {}
            if x.get("type") == "response_item" and p.get("type") in ("function_call", "custom_tool_call"):  # Codex
                yield p.get("name"), json.dumps(p.get("arguments") or p.get("input") or "", ensure_ascii=False), ""
            if x.get("type") == "assistant":
                for c in x["message"].get("content", []):
                    if c.get("type") == "tool_use":
                        yield c["name"], json.dumps(c.get("input", {}), ensure_ascii=False), ""

dirs = sys.argv[1:] or sorted(d for d in glob.glob(f"{B}/resultados/*/*") if os.path.isdir(d) and "_descartados" not in d)
for d in dirs:
    meta = json.load(open(os.path.join(d, "meta.json"))) if os.path.exists(os.path.join(d, "meta.json")) else {}
    hallazgos = []
    for tool, entrada, salida in llamadas(d):
        # quita la propia carpeta de trabajo: el ws de esta prueba aparece en sus rutas
        propia = re.findall(r"(/tmp/bench-ws/[^/\"]+/[A-Z0-9]{3}|/var/tmp/bench/ws-\w+|/tmp/bench-ws/claude-\w+/[A-Z0-9]{3})", entrada)
        limpia = entrada
        for p in set(propia[:1]):
            limpia = limpia.replace(p, "<propia>")
        # Codex: su propia configuración (skills de serie) tampoco es una fuga
        limpia = re.sub(r"/Users/[^/]+/\.codex-bench/" + re.escape(os.path.basename(os.path.dirname(d))) + r"/", "<propia-config>/", limpia)
        if PELIGRO.search(limpia):
            otros = sorted(set(re.findall(r"(?:claude-haiku|nvidia_[\w.-]+|ollama_[\w.-]+|anthropic_[\w.-]+)/[A-Z0-9]{3}/[\w.-]+", salida)))
            hallazgos.append(f"  {tool}: {limpia[:220]}" + (f"\n      vio: {', '.join(otros[:6])}" if otros else ""))
    rel = os.path.relpath(d, B)
    print(f"{'⚠' if hallazgos else '✔'} {rel}")
    for h in hallazgos:
        print(h)
