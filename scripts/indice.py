#!/usr/bin/env python3
"""indice.py: junta resultados/*/*/{meta,validacion,juicio}.json en resultados.json e index.html.

index.html usa rutas relativas: se abre desde benchmark/ con el navegador (o con el visor del repo).
"""
import html, json, os, glob

B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDEN = ["A3D", "AIF", "CCA", "PTS", "SEC"]
TIPO = {"A3D": "visual", "AIF": "visual", "CCA": "código", "PTS": "texto", "SEC": "seguridad"}
PREVIEW = "https://htmlpreview.github.io/?https://raw.githubusercontent.com/webreactiva/benchmarks/refs/heads/main"  # abre los HTML del repo para verlos funcionando
filas = []
for m in sorted(glob.glob(f"{B}/resultados/*/*/meta.json")):
    d = os.path.dirname(m)
    if "/_descartados/" in d or "/_retirados/" in d:
        continue
    r = {"dir": os.path.relpath(d, B), **json.load(open(m))}
    if r.get("esfuerzo"):  # Codex: el mismo modelo con distinto esfuerzo son filas distintas
        r["modelo"] += f" ({r['esfuerzo']})"
    for k in ("validacion", "juicio"):
        f = os.path.join(d, k + ".json")
        r[k] = json.load(open(f)) if os.path.exists(f) else None
    r["prompt"] = open(f"{B}/prompts/{r['codigo']}.txt").read().strip()
    filas.append(r)
filas.sort(key=lambda r: (r["modelo"], ORDEN.index(r["codigo"]) if r["codigo"] in ORDEN else 9))
json.dump(filas, open(f"{B}/resultados.json", "w"), indent=2, ensure_ascii=False)

e = html.escape
def k(n): return "–" if n is None else (f"{n/1000:.1f} k" if n >= 1000 else str(n))

def celda_val(r):
    v = r["validacion"] or {}
    out = []
    for h in v.get("html", []):
        out.append(("✔ carga" if not h["errores"] else f"✖ {len(h['errores'])} errores") + f" · {e(h['fichero'])}")
    for mm in v.get("mermaid", []):
        out.append(("✔ compila" if mm["ok"] else "✖ no compila") + f" · {e(mm['fichero'])}")
    for x in v.get("extra", []):
        out.append(e(x))
    return "<br>".join(out) or "–"

def en_vivo(r, base=""):
    """Enlaces para abrir los HTML de las pruebas visuales en el navegador."""
    if TIPO.get(r["codigo"]) != "visual":
        return []
    return [(h["fichero"], f"{base}{r['dir']}/salida/{h['fichero']}") for h in (r["validacion"] or {}).get("html", [])]

def captura(r):
    v = r["validacion"] or {}
    for x in v.get("html", []) + v.get("mermaid", []):
        if x.get("captura"):
            p = f"{r['dir']}/{x['captura']}"
            return f'<a href="{e(p)}"><img src="{e(p)}" loading="lazy"></a>'
    return ""

trs = []
for r in filas:
    t = r["tokens"] or {}
    j = r["juicio"] or {}
    nota = j.get("nota")
    fs = sorted(r["ficheros"], key=lambda f: (f.startswith(("dist/", "data/", "build/")) or f.endswith((".map", "-lock.json")), f))
    fich = "<br>".join(f'<a href="{e(r["dir"])}/salida/{e(f)}">{e(f)}</a>' for f in fs[:8])
    if len(r["ficheros"]) > 8:
        fich += f"<br>… y {len(r['ficheros']) - 8} más"
    trs.append(f"""<tr>
<td><b>{e(r['codigo'])}</b><br><small>{TIPO.get(r['codigo'], '')}</small></td>
<td><small>{e(r['modelo'])}</small><br><small>{e(r['agente'])} · {e(r['fecha'][:16].replace('T', ' '))} UTC</small></td>
<td class=n><b>{k(t.get('total'))}</b><br><small>in {k(t.get('input'))} · out {k(t.get('output'))}<br>razon. {k(t.get('reasoning'))} · caché {k(t.get('cache_read'))}</small></td>
<td class=n>{r['peticiones']}</td>
<td><small>{fich or '–'}</small></td>
<td><small>{celda_val(r)}</small></td>
<td class="nota n{'' if nota is None else int(nota) // 4}">{'–' if nota is None else nota}<br><small>{e(j.get('veredicto', ''))}</small></td>
<td><small>{e(j.get('resumen', ''))}</small>{f' <a href="{e(r["dir"])}/juicio.md">juicio</a>' if j else ''}{''.join(f' · <a href="{e(u)}">▶ en vivo</a>' for _, u in en_vivo(r, PREVIEW + "/"))}</td>
<td class=cap>{captura(r)}</td>
</tr>""")

prompts = "".join(f"<li><b>{c}</b> · {e(open(f'{B}/prompts/{c}.txt').read().strip())}</li>" for c in ORDEN)
destino = e(open(f"{B}/prompts/_destino.txt").read().strip())
open(f"{B}/index.html", "w").write(f"""<!doctype html><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>Benchmark de modelos</title>
<style>
:root{{--bg:#faf8f5;--fg:#222;--muted:#666;--line:#e3ddd5;--ok:#2f7d4f;--mid:#b07a12;--bad:#b23b3b}}
@media (prefers-color-scheme:dark){{:root{{--bg:#1b1a19;--fg:#eee;--muted:#aaa;--line:#3a3633}}}}
body{{background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif;margin:0;padding:24px 16px}}
h1{{margin:0 0 4px}} p,li{{color:var(--muted)}} a{{color:inherit}}
.wrap{{overflow-x:auto}} table{{border-collapse:collapse;width:100%;min-width:1100px}}
th,td{{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}}
th{{font-size:12px;text-transform:uppercase;color:var(--muted)}}
.n{{text-align:right;font-variant-numeric:tabular-nums}} .nota{{font-size:22px;font-weight:700;text-align:center}}
.n0{{color:var(--bad)}} .n1{{color:var(--mid)}} .n2{{color:var(--ok)}}
.cap img{{width:180px;border:1px solid var(--line);border-radius:4px}}
</style>
<h1>Benchmark de modelos</h1>
<p>Cada prompt se manda tal cual, en una sesión nueva de OpenCode aislado, con una sola frase añadida: «{destino}». Sin segundo mensaje ni correcciones. Tokens: suma de todas las peticiones de la sesión (entrada sin caché, salida, razonamiento y lectura de caché). Nota del juez de 0 a 10.</p>
<ul>{prompts}</ul>
<div class=wrap><table>
<tr><th>Prompt</th><th>Modelo</th><th>Tokens</th><th>Pet.</th><th>Ficheros</th><th>Validación</th><th>Nota</th><th>Juicio</th><th>Captura</th></tr>
{''.join(trs)}
</table></div>
""")

# README de cada modelo: tabla y rarezas
def kk(n): return "–" if n is None else (f"{n/1000:.1f} k".replace(".", ",") if n >= 1000 else str(n))
por_modelo = {}
for r in filas:
    por_modelo.setdefault(os.path.dirname(r["dir"]), []).append(r)
for carpeta, rs in por_modelo.items():
    notas = [r["juicio"]["nota"] for r in rs if r["juicio"]]
    tok = sum((r["tokens"] or {}).get("total", 0) for r in rs)
    pet = sum(r["peticiones"] for r in rs)
    hechos = {r["codigo"] for r in rs}
    faltan = [c for c in ORDEN if c not in hechos]
    l = [f"# {rs[0]['modelo']}", "",
         f"Agente: {rs[0]['agente']}. Fechas: {min(r['fecha'] for r in rs)[:10]} a {max(r['fecha'] for r in rs)[:10]}.", "",
         f"**Nota media: {sum(notas)/len(notas):.1f} / 10**".replace(".", ",", 1) + f" ({len(notas)} de {len(ORDEN)} prompts juzgados). "
         f"Total: {pet} peticiones y {kk(tok)} tokens.", ""]
    if faltan:
        l += [f"Pendientes: {', '.join(faltan)}.", ""]
    l += ["| Prompt | Tipo | Peticiones | Tokens | Nota | Veredicto | Juicio | En vivo |", "|---|---|---:|---:|---:|---|---|---|"]
    for r in rs:
        j = r["juicio"] or {}
        l.append(f"| [{r['codigo']}]({r['codigo']}/juicio.md) | {TIPO.get(r['codigo'], '')} | {r['peticiones']} | "
                 f"{kk((r['tokens'] or {}).get('total'))} | {j.get('nota', '–')} | {j.get('veredicto', 'sin juzgar')} | "
                 f"{j.get('resumen', '').replace('|', '/')} | "
                 + (" · ".join(f"[▶ {f}]({u})" for f, u in en_vivo(r, PREVIEW + "/")) or "–") + " |")
    l += ["", "Tokens: suma de todas las peticiones de la sesión (entrada, salida, razonamiento y caché). «En vivo» abre el HTML tal cual lo dejó el modelo, abierto con htmlpreview.github.io.", "", "## Rarezas", ""]
    for r in rs:
        rz = (r["juicio"] or {}).get("rarezas") or []
        if rz:
            l.append(f"**{r['codigo']}**"); l.append("")
            l += [f"- {x}" for x in rz]; l.append("")
    open(os.path.join(B, carpeta, "README.md"), "w").write("\n".join(l).rstrip() + "\n")
print(f"{len(filas)} resultados → index.html, resultados.json y {len(por_modelo)} README de modelo")
