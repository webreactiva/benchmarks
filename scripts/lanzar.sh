#!/usr/bin/env bash
# lanzar.sh <CODIGO> <modelo>
#   lanzar.sh CCA nvidia/nemotron-3-ultra-550b-a55b:free     OpenRouter (OPEN_ROUTER_API_KEY)
#   lanzar.sh CCA ollama/deepseek-v4.1-flash                  Ollama Cloud (OLLAMA_CLOUD_API_KEY)
# Abre un OpenCode aislado (sin la configuración ni el entorno de esta sesión) en tmux, en una carpeta vacía fuera
# del repo, le manda el prompt tal cual + la frase de destino (prompts/_destino.txt), espera a que acabe y guarda en
# resultados/<modelo>/<CODIGO>/:
#   salida/         lo que haya dejado el modelo en su carpeta (sin tocar)
#   respuesta.md    el texto de la conversación (lo que contestó en el chat)
#   sesion.json     la exportación de la sesión de OpenCode
#   pantalla.txt    la última pantalla
#   meta.json       código, modelo, fecha, prompt enviado, tokens y peticiones (scripts/tokens.py)
# No se le pide nada más al modelo: un solo mensaje por sesión.
set -eu
cod=$1 modelo=$2
B=$(cd "$(dirname "$0")/.." && pwd); R=$(cd "$B/.." && pwd)
# Herramientas: en el repositorio público van en herramientas/; aquí, en _comun/herramientas
if [ -d "$B/herramientas" ]; then H=$B/herramientas; else H=$R/_comun/herramientas; fi
slug=$(echo "$modelo" | tr '/:' '__')
dest=$B/resultados/$slug/$cod
[ -e "$dest/meta.json" ] && { echo "Ya existe $dest: bórralo para repetir"; exit 1; }
# Destino: prompts/_destino.txt, salvo que el prompt traiga el suyo (<COD>.destino; vacío en TCI, cuyo prompt ya dice dónde guardar)
destino="$B/prompts/_destino.txt"; [ -f "$B/prompts/$cod.destino" ] && destino="$B/prompts/$cod.destino"
prompt="$(cat "$B/prompts/$cod.txt")"; [ -s "$destino" ] && prompt="$prompt $(cat "$destino")"
# Prompts que empiezan con un proyecto en la carpeta (SEC, scripts/semilla.sh): la copia, sin búsqueda web y más tiempo
SEMILLA=${SEMILLA:-$("$B/scripts/semilla.sh" "$cod")}
[ -n "$SEMILLA" ] && { SIN_WEB=${SIN_WEB:-1}; ESPERA_MAX=${ESPERA_MAX:-5400}; }

# Una configuración por modelo: así se pueden lanzar varios modelos a la vez sin pisarse
export OPENCODE_AISLADO=${OPENCODE_AISLADO:-$HOME/.opencode-bench/$slug}
conf=$OPENCODE_AISLADO/config/opencode/opencode.json
mkdir -p "$(dirname "$conf")"
# Sin topes: los límites reales del modelo en su proveedor (scripts/limites.py). OpenCode usa
# min(limit.output, OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX) y esa variable vale 32 000 si no se da.
limites=$(python3 "$B/scripts/limites.py" "$modelo")
# SALIDA_MAX=65536 rebaja el tope de salida. Con PROVEEDOR_OR=google-ai-studio, un tope mayor de 65 536 lleva la
# petición al nivel «flex» de AI Studio, más lento: gemini-4-neon pasaba de ~6 min y se cortaba («Network connection lost»).
[ -n "${SALIDA_MAX:-}" ] && limites=$(echo "$limites" | python3 -c 'import json,sys; l=json.load(sys.stdin); l["output"]=min(l["output"], int(sys.argv[1])); l["fuente"]+=" · SALIDA_MAX"; print(json.dumps(l))' "$SALIDA_MAX")
salida_max=$(echo "$limites" | python3 -c 'import json,sys; print(json.load(sys.stdin)["output"])')
SIN_WEB=${SIN_WEB:-} python3 - "$conf" "$modelo" "$limites" <<'PY'
import json, sys, os
f, m, lim = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
c = json.load(open(f)) if os.path.exists(f) else {
  "$schema": "https://opencode.ai/config.json", "autoupdate": False,
  "provider": {"or": {"npm": "@ai-sdk/openai-compatible", "name": "OpenRouter",
    "options": {"baseURL": "https://openrouter.ai/api/v1", "apiKey": "{env:OPEN_ROUTER_API_KEY}"}, "models": {}}},
  "permission": {"edit": "allow", "bash": "allow", "webfetch": "allow", "external_directory": "allow"}}
c["provider"].setdefault("ol", {"npm": "@ai-sdk/openai-compatible", "name": "Ollama Cloud",
    "options": {"baseURL": "https://ollama.com/v1", "apiKey": "{env:OLLAMA_CLOUD_API_KEY}"}, "models": {}})
p, id = ("ol", m[len("ollama/"):]) if m.startswith("ollama/") else ("or", m)
c["provider"][p]["models"][id] = {"name": id, "limit": {"context": lim["context"], "output": lim["output"]}}
# OpenCode 2.x corta una petición a los 5 min sin cabeceras (headerTimeout) y a los 15 min sin fragmentos (chunkTimeout):
# un modelo que piensa mucho o escribe un fichero grande en una sola llamada se queda en «Network connection lost».
for prov in c["provider"].values():
    prov["options"].update({"timeout": False, "headerTimeout": False, "chunkTimeout": 3600000})
# PROVEEDOR_OR=google-ai-studio fija el proveedor de OpenRouter (sin respaldo). Solo por fallo técnico de la ruta por
# defecto (gemini-4-carbon por Vertex corta con «502 Network connection lost» a los ~5 min de razonar).
po = os.environ.get("PROVEEDOR_OR")
o = c["provider"]["or"]["options"]; o.pop("provider", None)  # OpenCode 2.x solo manda al cuerpo lo que va en extraBody
if po: o["extraBody"] = {"provider": {"only": [po], "allow_fallbacks": False}}
else: o.pop("extraBody", None)
c["model"] = p + "/" + id
# SIN_WEB=1 (SEC): sin búsqueda ni descarga web, para que no busque el proyecto original
web = "deny" if os.environ.get("SIN_WEB") else "allow"
c.setdefault("permission", {}).update({"webfetch": web, "websearch": web})
json.dump(c, open(f, "w"), indent=2)
PY

# Carpeta con nombre aleatorio, que se borra al terminar: así ningún modelo encuentra el trabajo de otro
mkdir -p /var/tmp/bench; ws=$(mktemp -d /var/tmp/bench/ws-XXXXXXXX)
if [ -n "$SEMILLA" ]; then cp -a "$SEMILLA"/. "$ws"/; fi
s=b-$cod-$(echo "$slug" | { md5sum 2>/dev/null || md5; } | cut -c1-6)
tmux kill-session -t "=$s" 2>/dev/null || true
# HOME propio: si no, OpenCode carga las skills de ~/.claude/skills y ~/.agents (pasó en la primera tanda)
casa=$OPENCODE_AISLADO/home; mkdir -p "$casa"
# Encerrado (scripts/encierro.sh): no ve el repo, ni /tmp, ni el resto de /root; el lanzador va en su configuración
cp "$H/opencode-aislado.sh" "$OPENCODE_AISLADO/"
tmux new-session -d -s "$s" -x 120 -y 36 -c "$ws" -e "OPENCODE_AISLADO=$OPENCODE_AISLADO" -e "OLLAMA_CLOUD_API_KEY=${OLLAMA_CLOUD_API_KEY:-}" -e "OPEN_ROUTER_API_KEY=${OPEN_ROUTER_API_KEY:-}" -e "OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX=$salida_max" "$B/scripts/encierro.sh $ws $OPENCODE_AISLADO env HOME=$casa OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX=$salida_max $OPENCODE_AISLADO/opencode-aislado.sh"
tmux set-option -t "=$s:" @agente opencode
tmux set-option -t "=$s:" @pantallas "$B/resultados/.pantallas"
for i in $(seq 1 90); do sleep 1; tmux capture-pane -p -t "=$s:" | grep -q "ctrl+p" && break; done
inicio=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ACEPTA=1 ESPERA_MAX=${ESPERA_MAX:-2400} LINEAS=12 "$H/tmux-agente.sh" di "$s" "$prompt" || true
# A veces el Enter llega antes de que OpenCode acepte la entrada y el prompt se queda escrito en la caja, con la portada
# (el logotipo) todavía en pantalla y sin ninguna petición: se vuelve a pulsar Enter (como mucho 3 veces).
for reintento in 1 2 3; do
  tmux capture-pane -p -t "=$s:" 2>/dev/null | grep -q "▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀▀▀▀" || break
  sleep 5; tmux send-keys -t "=$s:" Enter; sleep 5
  ESPERA_MAX=${ESPERA_MAX:-2400} LINEAS=12 "$H/tmux-agente.sh" espera "$s" >/dev/null || true
done
# Subagentes en segundo plano: si el modelo cierra su turno esperándolos («↓ 6 subagents» en la barra de estado), la
# sesión sigue viva y el turno vuelve cuando acaban. Se espera mientras la barra los muestre y la pantalla cambie; si
# la pantalla no cambia en ~10 min con el agente libre, se da por acabado (por si la barra los sigue listando al terminar).
espera_fondo() {
  local t0 prev cur igual=0; t0=$(date +%s); prev=""
  while tmux capture-pane -p -t "=$s:" 2>/dev/null | grep -qE "↓ [0-9]+ subagents?" \
        && [ $(( $(date +%s) - t0 )) -lt ${ESPERA_MAX:-2400} ]; do
    fondo=1; sleep 20
    ESPERA_MAX=${ESPERA_MAX:-2400} LINEAS=12 "$H/tmux-agente.sh" espera "$s" >/dev/null || true
    cur=$(tmux capture-pane -p -t "=$s:" 2>/dev/null | md5sum)
    if [ "$cur" = "$prev" ]; then igual=$((igual + 1)); [ $igual -ge 30 ] && break; else igual=0; fi
    prev=$cur
  done
}
fondo=0; espera_fondo
# Regla de las preguntas: el modelo decide siempre. Cada vez que pregunte, da opciones o pida que elijamos, se le
# contesta «Decide tú.» (como mucho 5 veces, para no entrar en un bucle). Dos formas de preguntar:
#   con la herramienta de preguntas (diálogo en pantalla): se cierra con Escape y se contesta;
#   en texto (acaba su turno con una pregunta y sin hacer nada más): se mira en la sesión exportada.
# Exporta una sesión: «session export» en OpenCode 2.x, «export» en 1.x
exporta() { local j; j=$(cd "$ws" && HOME=$casa "$H/opencode-aislado.sh" session export "$1" 2>/dev/null) && [ "${j:0:1}" = "{" ] && { echo "$j"; return; }
  (cd "$ws" && HOME=$casa "$H/opencode-aislado.sh" export "$1" 2>/dev/null); }
pregunta_en_texto() {
  local sid
  sid=$(cd "$ws" && HOME=$casa "$H/opencode-aislado.sh" session list --format json 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["id"] if d else "")' 2>/dev/null)
  [ -n "$sid" ] || return 1
  exporta "$sid" | python3 -c '
import json, sys
s = json.load(sys.stdin)
# OpenCode 1.x: info.role y parts; 2.x: type y content
a = [m for m in s["messages"] if m.get("info", m).get("role", m.get("type")) == "assistant"]
if not a or a[-1].get("info", a[-1]).get("finish") != "stop": sys.exit(1)
t = " ".join(p.get("text", "") for p in a[-1].get("parts", a[-1].get("content", [])) if p.get("type") == "text").strip()
sys.exit(0 if t.endswith("?") else 1)'
}
pregunto=0
while [ $pregunto -lt 5 ]; do
  if tmux capture-pane -p -t "=$s:" 2>/dev/null | grep -qE "esc dismiss|Enter to select|↑↓ select|Type your own answer|Type something"; then
    tmux send-keys -t "=$s:" Escape; sleep 3
  elif ! pregunta_en_texto; then
    break
  fi
  pregunto=$((pregunto + 1))
  ACEPTA=1 ESPERA_MAX=${ESPERA_MAX:-2400} LINEAS=12 "$H/tmux-agente.sh" di "$s" "Decide tú." || true
  espera_fondo
done
mkdir -p "$dest"
tmux capture-pane -p -t "=$s:" -S -3000 > "$dest/pantalla.txt"
"$H/tmux-agente.sh" para "$s" >/dev/null || true

# La sesión: la última de esa carpeta
id=$(cd "$ws" && HOME=$casa "$H/opencode-aislado.sh" session list --format json 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["id"] if d else "")' || true)
[ -n "$id" ] && exporta "$id" > "$dest/sesion.json" || true
rm -rf "$dest/salida"
if [ -n "$SEMILLA" ]; then python3 "$B/scripts/salida-semilla.py" "$SEMILLA" "$ws" "$dest"; else cp -R "$ws" "$dest/salida"; fi
rm -rf "$ws"
python3 "$B/scripts/tokens.py" "$dest" "$cod" "$modelo" "$inicio" "$prompt"
# Los subagentes son sesiones hijas que la exportación no trae: se suman desde la base de datos de OpenCode
python3 "$B/scripts/tokens-subagentes.py" "$dest" "$OPENCODE_AISLADO/data/opencode/opencode.db" || true
# Los límites con que corrió, en meta.json
python3 - "$dest/meta.json" "$limites" <<'PY'
import json, sys
f = sys.argv[1]; m = json.load(open(f)); m["limites"] = json.loads(sys.argv[2]); json.dump(m, open(f, "w"), indent=2, ensure_ascii=False)
PY
# Cuántas veces se le contestó «Decide tú.», en meta.json
python3 - "$dest/meta.json" "$pregunto" <<'PY'
import json, sys
f = sys.argv[1]; m = json.load(open(f)); m["veces_decide_tu"] = int(sys.argv[2]); json.dump(m, open(f, "w"), indent=2, ensure_ascii=False)
PY
if [ "$fondo" = 1 ]; then python3 - "$dest/meta.json" <<'PY'
import json, sys
f = sys.argv[1]; m = json.load(open(f)); m["espero_segundo_plano"] = True; json.dump(m, open(f, "w"), indent=2, ensure_ascii=False)
PY
fi
if [ -n "$SEMILLA" ]; then python3 - "$dest/meta.json" "$SEMILLA" "${SIN_WEB:-}" <<'PY'
import json, sys
f = sys.argv[1]; m = json.load(open(f)); m["semilla"] = sys.argv[2]
if sys.argv[3]: m["sin_web"] = "webfetch y websearch denegados en opencode.json"
json.dump(m, open(f, "w"), indent=2, ensure_ascii=False)
PY
fi
# Excepción macOS: con qué aislamiento y qué versión de OpenCode corrió
if [ "$(uname)" = Darwin ]; then python3 - "$dest/meta.json" "$(opencode --version 2>/dev/null)" <<'PY'
import json, sys
f = sys.argv[1]; m = json.load(open(f))
m["aislamiento"] = "macOS: sandbox-exec (sin leer /Users salvo su configuración y node; escribe solo en su carpeta), " + sys.argv[2] + " --standalone"
json.dump(m, open(f, "w"), indent=2, ensure_ascii=False)
PY
fi
