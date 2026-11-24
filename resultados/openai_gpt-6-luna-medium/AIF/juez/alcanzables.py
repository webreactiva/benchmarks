# python3 juez/alcanzables.py <carpeta AIF>: saca items, recetas e iniciales del HTML y calcula qué se alcanza
# desde los iniciales combinando lo ya descubierto (las claves de receta van ordenadas, como en combine()).
import json, re, sys, itertools
s = open(sys.argv[1] + "/salida/index.html").read()
items = re.findall(r"(\w+):\{name:'([^']+)'", s.split("const recipes")[0])
recetas = dict(re.findall(r"'([\w]+\+[\w]+)':'(\w+)'", s.split("const recipes")[1].split("};")[0]))
ini = re.search(r"const starters=\[([^\]]+)\]", s).group(1).replace("'", "").split(",")
hay = set(ini)
while True:
    nuevos = {r for a, b in itertools.combinations_with_replacement(sorted(hay), 2)
              if (r := recetas.get("+".join(sorted([a, b])))) and r not in hay}
    if not nuevos: break
    hay |= nuevos
todos = [k for k, _ in items]
print(json.dumps({"elementos": len(todos), "recetas": len(recetas), "iniciales": ini, "alcanzables": len(hay),
                  "no_alcanzables": [k for k in todos if k not in hay],
                  "recetas_con_ingrediente_imposible": [k for k in recetas if any(p not in hay for p in k.split("+"))]},
                 ensure_ascii=False, indent=1))
