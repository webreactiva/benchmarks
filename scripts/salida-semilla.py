#!/usr/bin/env python3
"""salida-semilla.py <semilla> <carpeta de trabajo> <destino>

Cuando el agente empieza con un proyecto en su carpeta (semilla), salida/ guarda solo lo que creó o cambió, y
cambios.txt lista lo nuevo, lo cambiado y lo borrado (y si dejó node_modules, .next o .git, que no se guardan).
"""
import filecmp, os, pathlib, shutil, sys

sem, ws, dest = map(pathlib.Path, sys.argv[1:4])
sal = dest / "salida"; sal.mkdir(parents=True, exist_ok=True)
ign = {"node_modules", ".next", ".git"}

def ficheros(r):
    for raiz, dirs, fs in os.walk(r):
        dirs[:] = [d for d in dirs if d not in ign]
        for f in fs:
            yield (pathlib.Path(raiz) / f).relative_to(r)

lineas = []
antes = set(ficheros(sem))
for rel in sorted(ficheros(ws)):
    if (ws / rel).is_symlink() or not (ws / rel).is_file():
        continue
    if rel not in antes or not filecmp.cmp(sem / rel, ws / rel, shallow=False):
        lineas.append(("cambiado " if rel in antes else "nuevo ") + rel.as_posix())
        (sal / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ws / rel, sal / rel)
lineas += ["borrado " + r.as_posix() for r in sorted(antes - set(ficheros(ws)))]
lineas += [f"generado {d}/ (no se guarda)" for d in sorted(ign) if (ws / d).exists()]
(dest / "cambios.txt").write_text("\n".join(lineas) + "\n")
