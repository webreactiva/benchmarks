#!/usr/bin/env python3
"""Compone el fichero único HTML de la ruta 3D por la Alhambra."""
import io, os, re, sys

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "src")
OUT = os.path.join(BASE, "alhambra-3d.html")

JS_PARTS = [
    "01_core.js",
    "02_entorno.js",
    "03_arquitectura.js",
    "03b_jardines.js",
    "04_recorrido.js",
    "05_ui.js",
    "06_main.js",
]


def read(path):
    with io.open(path, encoding="utf-8") as f:
        return f.read()


def main():
    css = read(os.path.join(SRC, "style.css"))

    three = read(os.path.join(SRC, "three.min.js"))
    # el build UMD de three avisa de su obsolescencia: se neutraliza la llamada
    three = re.sub(r"^console\.warn\('[^']*'\),", "void 0,", three, count=1)

    app = "\n".join(read(os.path.join(SRC, "js", p)) for p in JS_PARTS)

    html = read(os.path.join(SRC, "template.html"))
    html = html.replace("/*__CSS__*/", css)
    html = html.replace("/*__THREE__*/", three)
    html = html.replace("/*__APP__*/", app)

    with io.open(OUT, "w", encoding="utf-8") as f:
        f.write(html)

    size = os.path.getsize(OUT)
    print("→ %s  (%.1f KB)" % (OUT, size / 1024.0))


if __name__ == "__main__":
    main()
