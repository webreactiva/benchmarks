#!/usr/bin/env python3
"""exportar.py DESTINO [--sin-sesiones] [--solo MODELO,MODELO] [--dry-run]

Lleva el benchmark a otra carpeta (el repositorio público webreactiva/benchmarks) con todo lo necesario para
verlo y para seguir lanzándolo:

  README.md, rubricas.md, index.html, resultados.json      la portada, las reglas, la tabla
  prompts/                                                  los prompts tal cual (y los retirados)
  scripts/                                                  lanzadores, validador, slop, juez, índice
  herramientas/                                             tmux-agente.sh, opencode-aislado.sh, claude-aislado.sh
  resultados/<modelo>/{A3D,AIF,CCA,SEC}/                    salida, sesión, meta, validación, capturas, juez, juicio
  resultados/_descartados/, resultados/_retirados/          lo que no cuenta, con su motivo
  .claude/skills/benchmark-modelos/SKILL.md                 la skill, con las rutas del repositorio público

Se puede repetir: sustituye solo lo que gestiona (las carpetas y ficheros de arriba) y no toca .git, LICENSE ni
nada más del destino. Por el camino:
  - no copia node_modules, __pycache__, .pytest_cache ni las pantallas intermedias de tmux;
  - no copia ninguna sesión que haya leído skills privadas (rutas .claude/skills/synced): queda una nota en su lugar;
  - oculta nombres de contenedor e identificadores de organización;
  - al final busca claves y datos personales en el destino y para con error si encuentra alguno.

--sin-sesiones   no copia sesion.json ni sesion.jsonl (el repositorio pesa mucho menos; se pierde la traza)
--solo           solo esos modelos (nombre de carpeta en resultados/, separados por comas), más lo común
--dry-run        dice qué haría, sin escribir nada
"""
import fnmatch, json, os, re, shutil, subprocess, sys

B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))           # benchmark/
R = os.path.dirname(B)                                                      # raíz del repositorio de origen
args = [a for a in sys.argv[1:] if not a.startswith("--")]
if not args:
    sys.exit(__doc__)
DEST = os.path.abspath(args[0])
SIN_SESIONES = "--sin-sesiones" in sys.argv
DRY = "--dry-run" in sys.argv
SOLO = next((a.split("=", 1)[1] if "=" in a else sys.argv[sys.argv.index(a) + 1] for a in sys.argv if a.startswith("--solo")), None)
SOLO = set(SOLO.split(",")) if SOLO else None

IGNORA = ["node_modules", "__pycache__", ".pytest_cache", "*.pyc", ".pantallas", ".DS_Store", "*.tsbuildinfo"]
if SIN_SESIONES:
    IGNORA += ["sesion.json", "sesion.jsonl"]
TEXTO = (".json", ".jsonl", ".md", ".txt", ".ansi", ".html", ".js", ".mjs", ".ts", ".py", ".sh", ".css", ".mmd", ".svg", ".yml", ".yaml")
OCULTA = [
    (re.compile(r"container_[A-Za-z0-9]{8,}[A-Za-z0-9_-]*"), "container_<oculto>"),
    (re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b"), "<org>_<skills>"),
]
PRIVADO = "/.claude/skills/synced/"           # una sesión que leyó skills del autor
PROHIBIDO = [re.compile(p) for p in (r"sk-or-v1-[0-9a-f]{20,}", r"ghp_[A-Za-z0-9]{20,}", r"github_pat_[A-Za-z0-9_]{20,}",
                                      r"sk-ant-[A-Za-z0-9_-]{20,}", r"AKIA[0-9A-Z]{16}", r"[A-Za-z0-9._%+-]+@gmail\.com")]
for v in ("OPEN_ROUTER_API_KEY", "OLLAMA_CLOUD_API_KEY", "GH_TOKEN", "GITHUB_TOKEN"):
    if len(os.environ.get(v, "")) > 12:
        PROHIBIDO.append(re.compile(re.escape(os.environ[v])))

informe = {"copiados": 0, "ocultados": 0, "sesiones_privadas": [], "omitidos": 0}


def ignorado(nombre):
    return any(fnmatch.fnmatch(nombre, p) for p in IGNORA)


def copia_fichero(src, dst):
    informe["copiados"] += 1
    if DRY:
        return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if src.endswith(TEXTO) and os.path.getsize(src) < 200 * 1024 * 1024:
        try:
            t = open(src, encoding="utf-8").read()
        except UnicodeDecodeError:
            shutil.copy2(src, dst); return
        if os.path.basename(src).startswith("sesion.") and PRIVADO in t:
            informe["sesiones_privadas"].append(os.path.relpath(src, B))
            open(dst + ".omitida.md", "w").write(
                "# Sesión omitida\n\nEsta sesión no se publica: el agente leyó skills privadas del autor que no estaban "
                "aisladas (por eso la prueba está en `_descartados/`). El resultado, `meta.json` y `motivo.txt` sí están.\n")
            return
        n = 0
        for rx, rep in OCULTA:
            t, k = rx.subn(rep, t); n += k
        informe["ocultados"] += n
        open(dst, "w", encoding="utf-8").write(t)
    else:
        shutil.copy2(src, dst)


def copia_arbol(src, dst, filtro=None):
    for raiz, dirs, fs in os.walk(src):
        dirs[:] = [d for d in dirs if not ignorado(d)]
        rel = os.path.relpath(raiz, src)
        if filtro and not filtro(rel):
            continue
        for f in fs:
            if ignorado(f):
                informe["omitidos"] += 1; continue
            copia_fichero(os.path.join(raiz, f), os.path.join(dst, rel, f))


def reemplaza(destino_rel):
    d = os.path.join(DEST, destino_rel)
    if not DRY and os.path.exists(d):
        shutil.rmtree(d) if os.path.isdir(d) else os.remove(d)


def modelo_de(rel):
    partes = rel.split(os.sep)
    return partes[0] if partes and partes[0] not in (".",) else None


# 1. Lo común
os.makedirs(DEST, exist_ok=True) if not DRY else None
for f in ("README.md", "rubricas.md", "index.html", "resultados.json"):
    if os.path.exists(os.path.join(B, f)):
        reemplaza(f); copia_fichero(os.path.join(B, f), os.path.join(DEST, f))
# El README habla de benchmark/…: en el repositorio público, benchmark/ es la raíz
if not DRY and os.path.exists(os.path.join(DEST, "README.md")):
    t = open(os.path.join(DEST, "README.md")).read()
    t = re.sub(r"benchmark/(?=scripts|resultados|rubricas|prompts|README|index)", "", t)
    open(os.path.join(DEST, "README.md"), "w").write(t)
for d in ("prompts", "scripts"):
    reemplaza(d); copia_arbol(os.path.join(B, d), os.path.join(DEST, d))

# 2. Herramientas que viven en _comun/herramientas
reemplaza("herramientas")
for f in ("tmux-agente.sh", "opencode-aislado.sh", "claude-aislado.sh"):
    copia_fichero(os.path.join(R, "_comun", "herramientas", f), os.path.join(DEST, "herramientas", f))
    if not DRY:
        os.chmod(os.path.join(DEST, "herramientas", f), 0o755)

# 3. Resultados (todos o solo algunos modelos)
res = os.path.join(B, "resultados")
modelos = sorted(m for m in os.listdir(res) if os.path.isdir(os.path.join(res, m)) and not ignorado(m))
for m in modelos:
    if SOLO and m not in SOLO and not m.startswith("_"):
        continue
    reemplaza(os.path.join("resultados", m))
    copia_arbol(os.path.join(res, m), os.path.join(DEST, "resultados", m))

# 4. La skill, con las rutas del repositorio público (benchmark/ pasa a ser la raíz)
sk = os.path.join(R, ".claude", "skills", "benchmark-modelos", "SKILL.md")
if os.path.exists(sk) and not DRY:
    t = open(sk).read()
    t = t.replace("benchmark/scripts/", "scripts/").replace("benchmark/rubricas.md", "rubricas.md").replace("`benchmark/`", "este repositorio")
    t = t.replace("Todo vive en `benchmark/`.", "Todo vive en este repositorio.").replace("benchmark/README.md", "README.md").replace("benchmark/", "")
    t = t.replace(" Escribe en español y pasa `/unslop` a los textos.", " Escribe en español, sin muletillas ni frases hechas.")
    os.makedirs(os.path.join(DEST, ".claude", "skills", "benchmark-modelos"), exist_ok=True)
    open(os.path.join(DEST, ".claude", "skills", "benchmark-modelos", "SKILL.md"), "w").write(t)

# 5. Comprobación final: nada de claves ni datos personales
fallos = []
if not DRY:
    for raiz, _, fs in os.walk(DEST):
        if "/.git" in raiz:
            continue
        for f in fs:
            p = os.path.join(raiz, f)
            if not f.endswith(TEXTO) or os.path.getsize(p) > 200 * 1024 * 1024:
                continue
            try:
                t = open(p, encoding="utf-8").read()
            except UnicodeDecodeError:
                continue
            for rx in PROHIBIDO:
                if rx.search(t):
                    fallos.append(f"{os.path.relpath(p, DEST)}: {rx.pattern[:30]}")
    try:
        origen = subprocess.run(["git", "-C", R, "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    except Exception:
        origen = ""
    json.dump({"origen": "repositorio de trabajo · benchmark/", "commit": origen, "sin_sesiones": SIN_SESIONES,
               "modelos": sorted(SOLO) if SOLO else modelos, **{k: v for k, v in informe.items()}},
              open(os.path.join(DEST, ".exportacion.json"), "w"), indent=2, ensure_ascii=False)

print(f"{'(simulación) ' if DRY else ''}{informe['copiados']} ficheros → {DEST}")
print(f"  ocultados: {informe['ocultados']} · omitidos (node_modules, cachés…): {informe['omitidos']}")
for s in informe["sesiones_privadas"]:
    print(f"  sesión omitida por leer skills privadas: {s}")
if fallos:
    print("\n✖ El destino tiene datos que no deben publicarse:")
    print("\n".join("  " + f for f in fallos[:20]))
    sys.exit(1)
print("✔ sin claves ni datos personales")
