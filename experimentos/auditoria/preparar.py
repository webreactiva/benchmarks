#!/usr/bin/env python3
"""preparar.py --out DIR [--source CLON]

Prepara una copia anonimizada de realvuln-oss-oopssec-store (commit fijado) para el prompt de auditoría.
Parte del prepare.py que pasó el autor, pero va más lejos: aquella versión dejaba en la copia del agente los tests y
exploits con el nombre de cada fallo, las reglas de .cursor, los comentarios «VULNERABLE BY DESIGN» y las pistas de
prisma/seed.ts, que son casi la solución de cada vulnerabilidad.

Regla de oro: NINGÚN cambio mueve líneas. El ground truth de RealVuln está anclado a fichero y línea; todos los cambios
dentro de ficheros son sustituciones en la misma línea, y los ficheros del ground truth no se borran ni se renombran.
Al final se comprueba (privado/informe.json).

Resultado:
  DIR/semilla/   la copia que recibe el agente (se copia a su carpeta de trabajo; no lleva .git ni node_modules)
  DIR/privado/   original fijado, informe, mapa de renombrados y sumas SHA-256. Nunca al alcance del agente.
"""
import argparse, base64, hashlib, json, pathlib, re, shutil, subprocess, sys

REPO = "https://github.com/kolega-ai-dev/realvuln-oss-oopssec-store"
SHA = "0373cf43a9cc35ec835f79b562eb47f9fd1b1649"
HERE = pathlib.Path(__file__).resolve().parent
GT = HERE / "ground-truth.json"

# Nombre curioso, sin relación con el original
NOMBRE, NOMBRE_SLUG, PREFIJO = "Quokka Bazaar", "quokka-bazaar", "QKB"

# 1. Fuera: documentación, soluciones, tests y exploits con nombre de fallo, instrucciones para agentes, marca
BORRAR = [
    ".git", ".github", ".husky", ".cursor", "docs", "content", "hall-of-fame", "lab", "packages", "tests", "cypress",
    "app/vulnerabilities", "app/hall-of-fame", "public/exploits", "public/screen.png",
    "AGENTS.md", "CLAUDE.md", "EDUCATORS.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "README.md",
    "cypress.config.ts", "jest.config.ts", "tsconfig.jest.json", ".degitignore",
    # v2: la capa de juego (tablero, comprobador, pistas, guía) y las páginas que explican el reto
    "app/flags", "app/player-dashboard", "app/about", "app/terms", "app/api/hints", "app/api/flags/verify",
    "app/api/flags/count", "lib/validation/schemas/flags.ts", "lib/format.ts", "app/components/SupportBanner.tsx",
] + [f"app/components/{c}.tsx" for c in ("FlagChecker", "FlagCheckerWrapper", "FlagDisplay", "FlagToast", "HintPanel",
                                          "HintPanelWrapper", "OnboardingGuide", "ConsoleWelcome")]
# 2. Ficheros renombrados (y sus referencias): el nombre decía qué fallo los lee
RENOMBRAR = {"flag-xxe.txt": "supplier-registry.txt", "public/xss-flag.txt": "public/notice.txt"}

# 3. Marca (en orden: de lo más largo a lo más corto)
MARCA = [
    ("koadt.github.io/oss-oopssec-store", "docs.quokka-bazaar.example"),
    ("kOaDT/oss-oopssec-store", "quokka-labs/quokka-bazaar"),
    ("oss-oopssec-store", NOMBRE_SLUG), ("oss-oopssec", NOMBRE_SLUG),
    ("OSS – OopsSec Store", NOMBRE), ("OopsSec Store", NOMBRE), ("OopsSec", "Quokka"), ("oopssec", "quokka"),
    ("OOPSSEC", "QUOKKA"), ("kOaDT", "quokka-labs"), ("koadt", "quokka-labs"), ("oss-store", NOMBRE_SLUG),
    ("Oopsie!", "Hello!"), ("@oss.com", "@quokka.store"),
    ("★ Enjoying the lab? A star helps others find it:", "Quokka Bazaar is ready."), ("flag-xxe.txt", "supplier-registry.txt"), ("xss-flag.txt", "notice.txt"),
]
# 4. Raíces de identificadores que señalan el fallo (sqlInjectionDetected, csrfFlag, isSQLInjectionAttempt…).
#    Solo se tocan identificadores compuestos (camelCase/PascalCase/snake); las palabras sueltas pueden ser texto.
RAICES = ["Injection", "Xss", "XSS", "Ssrf", "SSRF", "Traversal", "Csrf", "CSRF", "Xxe", "XXE", "Idor", "IDOR",
          "Exploit", "Vuln", "Attack", "Bypass", "Oracle", "Fixation", "BruteForce", "Brute", "Malicious", "Backdoor",
          "Typosquat", "Poison", "Tamper", "Padding"]
# 5. Frases de la interfaz que delatan el reto o señalan dónde mirar (sustitución dentro de la línea)
FRASES = [
    (r"\bdeliberately vulnerable app\b", "independent online store"),
    (r"\b[Aa] vulnerable e-commerce application designed for modern web", "An e-commerce application for the modern web"),
    (r"\ba vulnerable e-commerce for modern web security training\b", "an independent online store"),
    (r"This application contains intentional security vulnerabilities", "This application is provided as is"),
    (r"Looking for vulnerabilities\? Check the page source for hidden", "Need more tools? Check the internal pages and"),
    (r"/exploits/csrf-attack\.html", "/static/a.html"), (r"/exploits/csrf-profile-takeover\.html", "/static/b.html"),
    (r"\bWalkthroughs\b", "Docs"), (r"\bWALKTHROUGH\b", "DOCS"),
]
TEXTO = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".prisma", ".css", ".html", ".md", ".txt", ".yml",
         ".yaml", ".sh", ".local", ".mdc", ".svg", ".example", ""}
CODIGO = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".prisma", ".css"}
HASH_COMENT = {".sh", ".yml", ".yaml", ".local", ".example", ""}  # Dockerfile, .env.local, docker-compose…
# Palabras que, en un comentario, delatan el reto o el fallo
PISTA = re.compile(
    r"vulnerab|intentional|by design|insecure|\bctf\b|flag|exploit|hint|walkthrough|challenge|attack|cwe-|owasp|"
    r"inject|xss|ssrf|csrf|xxe|traversal|idor|bola|bypass|oracle|brute|fixation|typosquat|backdoor|malicious|"
    r"leak|weak|tamper|forg|unsafe|unsanitiz|sanitiz|no (?:url )?validation|not validated|without (?:check|valid)|"
    r"hardcoded|predictable|rate limit|escalat|privilege|educational|training|student|player", re.I)


def run(*a, cwd=None):
    subprocess.run(a, cwd=cwd, check=True)


def leer(p):
    try:
        return p.read_text(encoding="utf-8")
    except (UnicodeError, OSError):
        return None


def es_texto(p):
    return p.suffix.lower() in TEXTO or p.name in ("Dockerfile", ".env.local", ".gitignore", ".dockerignore")


def h(s, n=12):
    return hashlib.sha256(("qkb-" + s).encode()).hexdigest()[:n]


def neutraliza_comentarios(texto, ext, nombre):
    """Vacía, sin mover líneas, los comentarios de línea entera que dan pistas. Devuelve (texto, n)."""
    salida, n, en_bloque = [], 0, False
    for linea in texto.split("\n"):
        s = linea.strip(); sangria = linea[: len(linea) - len(linea.lstrip())]
        nueva = linea
        if ext in CODIGO:
            if en_bloque:
                if s.endswith("*/"):
                    en_bloque = False
                    if PISTA.search(s):
                        nueva = sangria + "*/"
                elif PISTA.search(s):
                    nueva = sangria + ("*" if s.startswith("*") else "")
            elif s.startswith("//") and PISTA.search(s):
                nueva = sangria + "//"
            elif s.startswith("{/*") and s.endswith("*/}") and PISTA.search(s):
                nueva = sangria + "{/* */}"
            elif s.startswith("/*"):
                if s.endswith("*/") and len(s) > 3:
                    if PISTA.search(s):
                        nueva = sangria + "/* */"
                else:
                    en_bloque = True
                    if PISTA.search(s):
                        nueva = sangria + ("/**" if s.startswith("/**") else "/*")
            else:
                # Comentario al final de una línea de código: «código; // VULNERABLE…»
                m = re.search(r"\s//\s?(.*)$", linea)
                if m and PISTA.search(m.group(1)) and linea[: m.start()].count('"') % 2 == 0 \
                        and linea[: m.start()].count("'") % 2 == 0 and linea[: m.start()].count("`") % 2 == 0:
                    nueva = linea[: m.start()]
        elif (ext in HASH_COMENT or nombre in ("Dockerfile", ".env.local")) and s.startswith("#") and PISTA.search(s):
            nueva = sangria + "#"
        if nueva != linea:
            n += 1
        salida.append(nueva)
    return "\n".join(salida), n


def limpia_seed(texto):
    """prisma/seed.ts: vacía las pistas, quita CWE/OWASP/CVE/writeups y categoría, sin mover líneas."""
    lineas = texto.split("\n"); n = 0
    en_flags = en_pistas = False
    for i, l in enumerate(lineas):
        s = l.strip()
        if s.startswith("const flags = ["):
            en_flags = True
        elif s.startswith("const flagHints"):
            en_pistas = True
        elif en_flags and s == "];":
            en_flags = False
        elif en_pistas and s == "};":
            en_pistas = False
        nueva = l
        if en_flags:
            nueva = re.sub(r'^(\s*(?:cwe|owasp|cve|markdownFile|walkthroughSlug): )"[^"]*"', r'\1""', l)
            nueva = re.sub(r'^(\s*category: )"[A-Z_]+"', r'\1"OTHER"', nueva)
        elif en_pistas and re.match(r'^\s*"', l) and not re.match(r'^\s*"[^"]*": \[', l):
            nueva = re.sub(r'^(\s*)".*"(,?)\s*$', r'\1""\2', l)
        if nueva != l:
            n += 1; lineas[i] = nueva
    return "\n".join(lineas), n


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True)
    ap.add_argument("--source", help="clon local que contenga el commit fijado")
    ap.add_argument("--typescript", help="node_modules con typescript (si no, se instala en privado/herramientas)")
    a = ap.parse_args()
    out = pathlib.Path(a.out).resolve()
    if out.exists():
        sys.exit(f"No sobrescribo {out}")
    priv = out / "privado"; orig = priv / "original"; sem = out / "semilla"
    priv.mkdir(parents=True)
    run("git", "clone", "-q", *(["--local", str(pathlib.Path(a.source).resolve())] if a.source else [REPO]), str(orig))
    run("git", "fetch", "-q", "origin", SHA, cwd=orig)
    run("git", "checkout", "-q", "--detach", SHA, cwd=orig)
    if subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=orig, text=True).strip() != SHA:
        sys.exit("El commit no coincide")
    shutil.copytree(orig, sem, ignore=shutil.ignore_patterns(".git", "node_modules", ".next", "coverage"))
    informe = {"repo": REPO, "commit": SHA, "nombre": NOMBRE, "borrados": [], "renombrados": RENOMBRAR,
               "cambios_por_fichero": {}}

    def anota(rel, que, n=1):
        d = informe["cambios_por_fichero"].setdefault(rel, {})
        d[que] = d.get(que, 0) + n

    gt = json.load(open(GT))["findings"]
    gt_ficheros = sorted({f["file"] for f in gt})

    # 1. Borrar
    for r in BORRAR:
        p = sem / r
        if r in gt_ficheros:
            sys.exit(f"{r} está en el ground truth: no se borra")
        if p.is_dir():
            shutil.rmtree(p); informe["borrados"].append(r + "/")
        elif p.exists():
            p.unlink(); informe["borrados"].append(r)
    for p in list(sem.rglob("*")):  # cualquier readme o walkthrough que quede (documents/readme.txt lo usa la app: se queda)
        rel = p.relative_to(sem).as_posix()
        if p.is_file() and (re.match(r"readme", p.name, re.I) or "walkthrough" in p.name.lower()) \
                and rel != "documents/readme.txt" and rel not in gt_ficheros:
            p.unlink(); informe["borrados"].append(rel)

    # 2. Renombrar ficheros
    for viejo, nuevo in RENOMBRAR.items():
        assert viejo not in gt_ficheros
        (sem / viejo).rename(sem / nuevo)

    # 3. prisma/seed.ts: pistas, CWE, writeups, categorías
    seed = sem / "prisma/seed.ts"; t, n = limpia_seed(seed.read_text()); seed.write_text(t); anota("prisma/seed.ts", "seed", n)

    # 4. Mapas: flags (y su base64), slugs, identificadores
    st = seed.read_text()
    flags = sorted(set(re.findall(r'"(OSS\{[^"}]+\})"', st)) | set(re.findall(r'OSS\{[A-Za-z0-9_]+\}', st)))
    textos = {p: leer(p) for p in sem.rglob("*") if p.is_file() and es_texto(p)}
    textos = {p: t for p, t in textos.items() if t is not None}
    todo = "\n".join(textos.values())
    flags = sorted(set(flags) | set(re.findall(r"OSS\{[A-Za-z0-9_]+\}", todo)))
    mapa_flags = {f: f"{PREFIJO}{{{h(f)}}}" for f in flags if f not in ("OSS{...}", "OSS{flag}")}
    mapa_b64 = {base64.b64encode(f.encode()).decode(): base64.b64encode(n.encode()).decode() for f, n in mapa_flags.items()}
    slugs = re.findall(r'^\s*slug: "([^"]+)"', st, re.M)
    mapa_slugs = {s: f"case-{h(s, 6)}" for s in slugs}
    pat_id = re.compile(r"\b[A-Za-z0-9_]*?(?:" + "|".join(RAICES) + r"|" + "|".join(r.lower() for r in RAICES)
                        + r")[A-Za-z0-9_]*\b")
    candidatos = set()
    for p, t in textos.items():
        if p.suffix in CODIGO:
            for m in pat_id.finditer(t):
                tok = m.group(0)
                compuesto = bool(re.search(r"[a-z][A-Z]|[A-Z]{2,}[a-z]|_", tok)) and not tok.isupper()
                if compuesto and not tok.startswith("OSS"):
                    candidatos.add(tok)
    mapa_ids = {"createWeakJWT": "createSessionToken", "decodeWeakJWT": "decodeSessionToken", "leakedData": "extraData",
                "BFLA_FLAG_SLUG": "LIVE_EVENT_SLUG", "csrfExploited": "profileSyncPending"}
    for tok in sorted(candidatos):
        nuevo = tok
        for r in sorted(RAICES, key=len, reverse=True):
            nuevo = re.sub(r, "Qk" + h(r, 3).upper(), nuevo)
            nuevo = re.sub(r"(?<![A-Za-z])" + r.lower(), "qk" + h(r, 3), nuevo)
        if nuevo != tok and tok not in mapa_ids:
            mapa_ids[tok] = nuevo

    # 5. Aplicar a todos los ficheros de texto
    for p, t in textos.items():
        rel = p.relative_to(sem).as_posix(); ext = p.suffix.lower(); antes = t
        nl = t.count("\n")
        for v, n in mapa_flags.items():
            if v in t: t = t.replace(v, n); anota(rel, "flags")
        for v, n in mapa_b64.items():
            if v in t: t = t.replace(v, n); anota(rel, "flags_base64")
        t = t.replace("OSS{", PREFIJO + "{").replace('"oss{"', '"' + PREFIJO.lower() + '{"')
        for v, n in mapa_slugs.items():
            t2 = re.sub(r"(?<![A-Za-z0-9_-])" + re.escape(v) + r"(?![A-Za-z0-9_-])", n, t)
            if t2 != t: anota(rel, "slugs"); t = t2
        t = re.sub(r"^(\s*)(case-[0-9a-f]{6}):", r'\1"\2":', t, flags=re.M)  # clave sin comillas (react2shell:)
        if ext in CODIGO:
            for v, n in mapa_ids.items():
                t2 = re.sub(r"\b" + re.escape(v) + r"\b", n, t)
                if t2 != t: anota(rel, "identificadores"); t = t2
        if rel not in gt_ficheros:
            for v, n in FRASES:
                t2 = re.sub(v, n, t)
                if t2 != t: anota(rel, "frases"); t = t2
        for v, n in MARCA:
            if v in t: t = t.replace(v, n); anota(rel, "marca")
        # Rótulos en ASCII con el nombre original (consola del navegador, setup.sh)
        lineas = t.split("\n")
        for i, l in enumerate(lineas):
            cuerpo = re.sub(r'^\s*echo\s+"(.*)"\s*$', r"\1", l).replace(" ", "")
            if len(cuerpo) >= 3 and "_" in cuerpo and re.fullmatch(r"[_/\\()<>|.,'`-]+", cuerpo):
                lineas[i] = 'echo ""' if l.lstrip().startswith("echo ") else ""
                anota(rel, "rotulo_ascii")
        t = "\n".join(lineas)
        t, n = neutraliza_comentarios(t, ext, p.name)
        if n: anota(rel, "comentarios", n)
        assert t.count("\n") == nl, f"{rel}: cambia el número de líneas"
        if t != antes:
            p.write_text(t, encoding="utf-8")

    # 6. package.json: metadatos fuera, nombre curioso
    for pj in [sem / "package.json", sem / "package-lock.json"]:
        o = json.loads(pj.read_text())
        for k in ("description", "homepage", "repository", "bugs", "author", "contributors", "keywords"):
            o.pop(k, None)
        o["name"] = NOMBRE_SLUG
        if "packages" in o and "" in o["packages"]:
            o["packages"][""]["name"] = NOMBRE_SLUG
        pj.write_text(json.dumps(o, indent=2, ensure_ascii=False) + "\n")
        anota(pj.name, "metadatos")

    # 6b. v2: comentarios, código que da flags junto a cada fallo y restos de la capa de juego (limpiar-ctf.js)
    rangos = {}
    for f in gt:
        a_, b_ = f["location"]["start_line"], f["location"]["end_line"]
        if b_ - a_ < 200:
            rangos.setdefault(f["file"], []).append([a_, b_])
        for loc in f.get("acceptable_locations", []):
            rangos.setdefault(loc["file"], []).append([loc["start_line"], loc["end_line"]])
    (priv / "rangos.json").write_text(json.dumps(rangos))
    tsdir = pathlib.Path(a.typescript) if a.typescript else priv / "herramientas" / "node_modules"
    if not (tsdir / "typescript").exists():
        run("npm", "install", "--silent", "--no-audit", "--no-fund", "--prefix", str(tsdir.parent), "typescript@5.9.3")
    subprocess.run(["node", str(HERE / "limpiar-ctf.js"), str(sem), str(priv / "rangos.json"), str(priv / "limpieza-ctf.json")],
                   check=True, env={**__import__("os").environ, "NODE_PATH": str(tsdir)})
    # Parches a mano (v2): lo que el limpiador automático no alcanza. Cada uno debe aplicarse exactamente las veces
    # indicadas y no mover líneas.
    def parche(rel, patron, nuevo, veces=1):
        f = sem / rel; t = f.read_text()
        t2, n = re.subn(patron, nuevo, t)
        assert n == veces, f"parche {rel}: {patron[:50]!r} se aplicó {n} veces (esperaba {veces})"
        assert t2.count("\n") == t.count("\n"), f"parche {rel}: mueve líneas"
        f.write_text(t2); anota(rel, "parche", n)
    blanco = lambda m: "\n" * m.group(0).count("\n")
    for rel in ("app/api/auth/login/route.ts", "app/api/auth/signup/route.ts", "app/api/auth/support-login/route.ts"):
        parche(rel, r'\n\s*hint: "The secret is not so secret",', "\n")          # pista del secreto JWT en el token
    for rel in ("app/internal/page.tsx", "app/internal/oauth/callback/page.tsx", "app/monitoring/internal-status/page.tsx"):
        parche(rel, r"async function getFlag\(\) \{\n[\s\S]*?\n\}", blanco)
        parche(rel, r"const flag = await getFlag\(\);", "")
    for rel in ("app/admin/products/ProductsManagementClient.tsx", "app/orders/search/OrderSearchClient.tsx",
                "app/products/search/ProductSearchClient.tsx"):
        f = sem / rel; t = f.read_text(); f.write_text(re.sub(r"\bflag\b", "notice", re.sub(r"\bsetFlag\b", "setNotice", t)))
    for rel in ("app/api/user/export/route.ts", "app/api/mcp/route.ts"):
        parche(rel, r"const flag = await prisma\.flag", "const row = await prisma.flag")
        parche(rel, r"\bflag\?\.flag\b", "row?.flag")
    parche("app/api/auth/login/route.ts", r"\bLOGIN_FLAG\b", "AUDIT_TAG", veces=3)
    parche("app/api/auth/login/route.ts", r"\bflag: AUDIT_TAG", "tag: AUDIT_TAG")
    parche("app/api/auth/login/route.ts", r"flag=\$\{AUDIT_TAG\}", "tag=${AUDIT_TAG}")
    parche("app/order/OrderClient.tsx", r"\bflagFromUrl\b", "noteFromUrl", veces=2)
    parche("app/order/OrderClient.tsx", r'searchParams\.get\("flag"\)', 'searchParams.get("note")')
    parche("app/checkout/CheckoutClient.tsx", r"\n\s*flag\?: string;", "\n")
    parche("app/checkout/CheckoutClient.tsx",
           r"const url = order\.flag\n\s*\? `/order\?id=\$\{order\.id\}&flag=\$\{encodeURIComponent\(order\.flag\)\}`\n\s*: (`/order\?id=\$\{order\.id\}`);",
           lambda m: f"const url = {m.group(1)};\n\n")
    for rel in ("app/api/orders/search/route.ts", "app/api/products/search/route.ts", "app/api/admin/reviews/route.ts"):
        f = sem / rel; t = f.read_text(); f.write_text(t.replace('includes("flags")', 'includes("qkb{")').replace('includes("flag")', 'includes("qkb{")'))
    parche("app/admin/AdminClient.tsx",                                       # enlaces ocultos a las páginas de exploits
           r'<div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">\n[\s\S]*?Profile Update\n\s*</a>\n\s*</div>', blanco)
    parche("lib/types/index.ts", r"export type FlagCategory =[\s\S]*?export interface HintState \{[\s\S]*?\n\}", blanco)
    # Detector de peticiones de otro origen en el perfil: marcaba el usuario y lo limpiaba al leerlo
    parche("app/api/user/profile/route.ts", r"\n\s*profileSyncPending: true,", "\n")
    parche("app/api/user/profile/route.ts", r"\n    if \(dbUser\.profileSyncPending\) \{[\s\S]*?\n    \}", blanco)
    parche("app/api/user/profile/route.ts", r'const referer = request\.headers\.get\("referer"\);[\s\S]*?\n    \}', blanco)
    parche("lib/config.ts", r'export const TUTORIAL_FLAG = "[^"]*";', "")

    # comentarios «#» de shell, Dockerfile, yml y .env (menos el shebang)
    for p in sem.rglob("*"):
        if p.is_file() and (p.suffix in (".sh", ".yml", ".yaml") or p.name in ("Dockerfile", ".env.local", ".dockerignore", ".gitignore")):
            t = p.read_text(); ls_ = t.split("\n")
            ls_ = [("" if l.strip().startswith("#") and not l.startswith("#!") else l) for l in ls_]
            if "\n".join(ls_) != t:
                p.write_text("\n".join(ls_)); anota(p.relative_to(sem).as_posix(), "comentarios_shell")
    # package.json: fuera los scripts y dependencias de tests y documentación de la app original
    pj = sem / "package.json"; o = json.loads(pj.read_text())
    o["scripts"] = {k: v for k, v in o["scripts"].items() if not re.match(r"(docs:|test|prepare$)", k)}
    for dep in ("cypress", "jest", "ts-jest", "@types/jest", "@testing-library/jest-dom", "wait-on", "husky", "lint-staged"):
        o.get("devDependencies", {}).pop(dep, None)
    o.pop("lint-staged", None)
    pj.write_text(json.dumps(o, indent=2, ensure_ascii=False) + "\n")
    run("npm", "install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund", "--silent", cwd=sem)

    # 7. Comprobaciones: los ficheros del ground truth siguen ahí y con las mismas líneas; diff de cada rango puntuable
    comp = []
    for f in gt:
        a_, b_ = orig / f["file"], sem / f["file"]
        la, lb = a_.read_text().split("\n"), (b_.read_text().split("\n") if b_.exists() else None)
        ini, fin = f["location"]["start_line"], f["location"]["end_line"]
        cambiadas = [] if lb is None else [i for i in range(ini, min(fin, len(la)) + 1) if la[i - 1] != lb[i - 1]]
        comp.append({"id": f["id"], "fichero": f["file"], "existe": lb is not None,
                     "mismas_lineas": lb is not None and len(la) == len(lb),
                     "lineas_cambiadas_en_rango": cambiadas if fin - ini < 50 else len(cambiadas),
                     "detalle": [(i, la[i - 1].strip()[:120], lb[i - 1].strip()[:120]) for i in cambiadas][:5]
                     if fin - ini < 50 else []})
    informe["ground_truth"] = comp
    malos = [c for c in comp if not c["existe"] or not c["mismas_lineas"]]
    informe["mapas"] = {"flags": mapa_flags, "slugs": mapa_slugs, "identificadores": mapa_ids}
    # Restos: lo que el filtro aún encuentra (para revisarlo a mano), y las flags originales en claro o en base64/hex
    restos = []
    for p in sem.rglob("*"):
        t = leer(p) if p.is_file() and es_texto(p) else None
        if t is None: continue
        for i, l in enumerate(t.split("\n"), 1):
            if re.search(r"vulnerab|intentional|\bctf\b|walkthrough|exploit|oops|koadt|realvuln|OSS\{", l, re.I):
                restos.append({"f": p.relative_to(sem).as_posix(), "l": i, "t": l.strip()[:160]})
        for f in mapa_flags:
            interior = f[4:-1]
            if len(interior) < 8: continue
            for forma in (interior, base64.b64encode(f.encode()).decode(), f.encode().hex(), interior[::-1]):
                if forma in t:
                    restos.append({"f": p.relative_to(sem).as_posix(), "flag_original": f})
    informe["restos"] = restos
    (priv / "informe.json").write_text(json.dumps(informe, indent=1, ensure_ascii=False) + "\n")
    (priv / "SHA256SUMS.txt").write_text("".join(
        f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(sem).as_posix()}\n"
        for p in sorted(sem.rglob("*")) if p.is_file()))
    print(f"semilla: {sem}\nprivado: {priv}\nficheros: {sum(1 for p in sem.rglob('*') if p.is_file())}\n"
          f"flags {len(mapa_flags)} · slugs {len(mapa_slugs)} · identificadores {len(mapa_ids)} · restos {len(restos)}\n"
          f"ground truth: {len(comp)} entradas, {len(malos)} con fichero ausente o líneas movidas")
    if malos:
        sys.exit(1)


if __name__ == "__main__":
    main()
