#!/usr/bin/env python3
"""tokens-subagentes.py <resultados/<modelo>/<CÓDIGO>> [opencode.db]

Suma a meta.json los tokens y las peticiones de los subagentes de una sesión de OpenCode. tokens.py solo lee la
exportación de la sesión principal, y los subagentes (la herramienta «subagent», que el modelo lanza en paralelo)
son sesiones hijas que no salen ahí: Kimi-K3.1-pro en TCI apuntaba 252 k tokens cuando gastó 2,4 M.

Lee la base de datos de OpenCode del modelo (por defecto ~/.opencode-bench/<carpeta>/data/opencode/opencode.db), busca
las sesiones con parent_id = meta.json → sesion (y sus hijas, por si un subagente lanza otros), suma sus tokens y
cuenta sus respuestas como peticiones. Deja el detalle en meta.json → subagentes. Es idempotente: si ya está
sumado, no vuelve a sumar.
"""
import json, os, pathlib, sqlite3, sys

d = pathlib.Path(sys.argv[1])
meta = json.load(open(d / "meta.json"))
if meta.get("subagentes"):
    print(f"{d}: ya sumado"); sys.exit(0)
sid = meta.get("sesion")
db = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser(f"~/.opencode-bench/{d.parent.name}/data/opencode/opencode.db")
if not sid or not os.path.exists(db):
    print(f"{d}: sin sesión o sin base de datos ({db})"); sys.exit(0)
c = sqlite3.connect(db); c.row_factory = sqlite3.Row
hijos, pend = [], [sid]
while pend:
    p = pend.pop()
    for r in c.execute("select id, title, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write "
                       "from session_v2 where parent_id = ?", (p,)):
        hijos.append(r); pend.append(r["id"])
if not hijos:
    print(f"{d}: sin subagentes"); sys.exit(0)
claves = {"input": "tokens_input", "output": "tokens_output", "reasoning": "tokens_reasoning",
          "cache_read": "tokens_cache_read", "cache_write": "tokens_cache_write"}
suma = {k: sum(r[v] or 0 for r in hijos) for k, v in claves.items()}
pet = sum(c.execute("select count(*) from session_message where session_id = ? and type = 'assistant'", (r["id"],)).fetchone()[0]
          for r in hijos)
t = meta.setdefault("tokens", {}) or {}
for k, v in suma.items():
    t[k] = (t.get(k) or 0) + v
t["total"] = sum(t.get(k) or 0 for k in claves)
meta["tokens"] = t
meta["peticiones"] = (meta.get("peticiones") or 0) + pet
meta["subagentes"] = {"sesiones": len(hijos), "tokens": sum(suma.values()), "peticiones": pet,
                      "titulos": [r["title"] for r in hijos]}
json.dump(meta, open(d / "meta.json", "w"), indent=2, ensure_ascii=False)
print(f"{d}: +{len(hijos)} subagentes, +{sum(suma.values())} tokens, +{pet} peticiones → {t['total']} tokens, {meta['peticiones']} peticiones")
