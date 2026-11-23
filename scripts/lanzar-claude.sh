#!/usr/bin/env bash
# lanzar-claude.sh <CODIGO> <modelo de Claude Code>
#   lanzar-claude.sh CCA haiku
#   ESFUERZO=medium lanzar-claude.sh CCA claude-sonnet-5-5   # con --effort; la carpeta es anthropic_<modelo>-<esfuerzo>
# Como lanzar.sh, pero con Claude Code aislado (claude-aislado.sh, --permission-mode auto): configuración y HOME
# propios (sin skills, sin CLAUDE.md, sin ajustes de nadie), carpeta vacía fuera del repo y un solo mensaje:
# el prompt tal cual + prompts/_destino.txt. Guarda lo mismo que lanzar.sh; sesion.jsonl es el registro de Claude Code.
set -eu
cod=$1 alias=$2
esf=${ESFUERZO:-}; efarg=""; sufijo=""
[ -n "$esf" ] && [ "$esf" != default ] && { efarg="--effort $esf"; sufijo="-$esf"; }
B=$(cd "$(dirname "$0")/.." && pwd); R=$(cd "$B/.." && pwd)
# Herramientas: en el repositorio público van en herramientas/; aquí, en _comun/herramientas
if [ -d "$B/herramientas" ]; then H=$B/herramientas; else H=$R/_comun/herramientas; fi
# PROMPTS y RESULTADOS cambian de dónde sale el prompt y dónde se guarda (pruebas aparte). SEMILLA copia un proyecto en
# la carpeta de trabajo antes de empezar (scripts/semilla.sh la da para SEC); SIN_WEB=1 le quita WebSearch y WebFetch.
P=${PROMPTS:-$B/prompts}; RES=${RESULTADOS:-$B/resultados}
# Prompts que empiezan con un proyecto en la carpeta (SEC): la copia, sin búsqueda web y con más tiempo
SEMILLA=${SEMILLA:-$("$B/scripts/semilla.sh" "$cod")}
[ -n "$SEMILLA" ] && { SIN_WEB=${SIN_WEB:-1}; ESPERA_MAX=${ESPERA_MAX:-5400}; }
prompt="$(cat "$P/$cod.txt") $(cat "$P/_destino.txt")"
base=${CLAUDE_BENCH:-$HOME/.claude-bench/$alias$sufijo}
conf=$base/config; casa=$base/home; mkdir -p "$conf" "$casa"
# Carpeta con nombre aleatorio, que se borra al terminar: así ningún modelo encuentra el trabajo de otro
mkdir -p /var/tmp/bench; ws=$(mktemp -d /var/tmp/bench/ws-XXXXXXXX)
[ -n "${SEMILLA:-}" ] && cp -a "$SEMILLA"/. "$ws"/
# Encerrado (scripts/encierro.sh): no ve el repo, ni /tmp, ni el resto de /root; el lanzador va en su configuración
cp "$H/claude-aislado.sh" "$base/"
# Sin la recomendación de plugins LSP: su diálogo tapa el «esc to interrupt» y el lanzador da la sesión por acabada
python3 -c '
import json, os, sys
f = sys.argv[1]; d = json.load(open(f)) if os.path.exists(f) else {}
d["lspRecommendationDisabled"] = True; json.dump(d, open(f, "w"), indent=2)' "$conf/.claude.json"
python3 -c '
import json, os, sys
f = sys.argv[1]; d = json.load(open(f)) if os.path.exists(f) else {}
p = d.setdefault("permissions", {}); den = [x for x in p.get("deny", []) if x not in ("WebSearch", "WebFetch")]
if sys.argv[2]: den += ["WebSearch", "WebFetch"]
p["deny"] = den; json.dump(d, open(f, "w"), indent=2)' "$conf/settings.json" "${SIN_WEB:-}"
s=c-$cod-$(echo "$alias$sufijo" | tr -cd "a-z0-9-") tp="=$s:"
tmux kill-session -t "=$s" 2>/dev/null || true
# SIN_ENCIERRO=1: sin encierro.sh, como en cursos-y-guias. En la nube Claude Code entra con la credencial de la sesión
# que lo dirige (/home/claude/.claude/remote), y el encierro la oculta con /home vacío. Se apunta en meta.json → aislamiento.
enc="TOKEN_CLAUDE=1 $B/scripts/encierro.sh $ws $base"; [ -n "${SIN_ENCIERRO:-}" ] && enc=""
tmux new-session -d -s "$s" -x 120 -y 36 -c "$ws" \
  "$enc env HOME=$casa CLAUDE_LOOP_CONFIG=$conf $base/claude-aislado.sh --permission-mode auto --model $alias $efarg"
tmux set-option -t "$tp" @agente claude
tmux set-option -t "$tp" @pantallas "$B/resultados/.pantallas"
pantalla() { tmux capture-pane -p -t "$tp" 2>/dev/null; }
# Primera vez: tema, avisos y confianza en la carpeta («No, exit» viene marcado: se baja hasta «❯ Yes»)
for i in $(seq 1 90); do
  sleep 1; scr=$(pantalla)
  if echo "$scr" | grep -q "No, exit"; then
    sleep 1; tmux send-keys -t "$tp" Down
    for j in $(seq 1 20); do sleep 0.5; pantalla | grep -q "❯ Yes" && break; done
    pantalla | grep -q "❯ Yes" && tmux send-keys -t "$tp" Enter; sleep 3
  elif echo "$scr" | grep -qE "shift\+tab to cycle|\? for shortcuts"; then break
  elif echo "$scr" | grep -qiE "text style|Choose .*theme|Security notes|Press Enter to continue|auto mode"; then
    sleep 1; tmux send-keys -t "$tp" Enter; sleep 2
  elif echo "$scr" | grep -qiE "login method|Select login|Paste code"; then
    echo "== Claude pide iniciar sesión"; pantalla | tail -15; exit 1
  fi
done
inicio=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ESPERA_MAX=${ESPERA_MAX:-2400} LINEAS=12 "$H/tmux-agente.sh" di "$s" "$prompt" || true
# Permisos del modo auto: si Claude Code pide permiso con cuenta atrás («will automatically block this request»), no se
# contesta (sin encierro, aprobar a ciegas es arriesgado): se deja que lo bloquee solo y se sigue esperando, como en una
# sesión desatendida. Antes el lanzador lo tomaba por el final (Opus 5.5 CCA en _descartados/).
espera_permisos() {
  local n=0
  while [ $n -lt 10 ] && pantalla | grep -q "automatically block this request"; do
    n=$((n + 1)); permisos=$((permisos + 1)); sleep 150
    ESPERA_MAX=${ESPERA_MAX:-2400} LINEAS=12 "$H/tmux-agente.sh" espera "$s" || true
  done
}
# Tareas en segundo plano: si el modelo cierra su turno esperando a sus subagentes («Waiting for N background agents»),
# la sesión sigue viva y el turno vuelve cuando acaban. Se espera a que no quede ninguna (como mucho ESPERA_MAX).
espera_fondo() {
  local t0=$(date +%s)
  while pantalla | grep -qE "Waiting for [0-9]+ background|background (agents?|tasks?) (still )?running|^\s*◯ " \
        && [ $(( $(date +%s) - t0 )) -lt ${ESPERA_MAX:-2400} ]; do
    fondo=1; sleep 20
    ESPERA_MAX=${ESPERA_MAX:-2400} LINEAS=12 "$H/tmux-agente.sh" espera "$s" >/dev/null || true
  done
}
permisos=0; fondo=0; espera_permisos; espera_fondo; espera_permisos
# Regla de las preguntas: el modelo decide siempre. Cada vez que pregunte, da opciones o pida que elijamos, se cierra
# la pregunta y se le contesta «Decide tú.» (como mucho 5 veces, para no entrar en un bucle)
pregunto=0
while [ $pregunto -lt 5 ] && tmux capture-pane -p -t "=$s:" 2>/dev/null | grep -qE "esc dismiss|Enter to select|↑↓ select|Type your own answer|Type something"; do
  pregunto=$((pregunto + 1))
  tmux send-keys -t "=$s:" Escape; sleep 3
  ACEPTA=1 ESPERA_MAX=${ESPERA_MAX:-2400} LINEAS=12 "$H/tmux-agente.sh" di "$s" "Decide tú." || true
  espera_permisos; espera_fondo
done
pantalla_final=$(tmux capture-pane -p -t "$tp" -S -3000)
tmux send-keys -t "$tp" -l "/exit"; sleep 1; tmux send-keys -t "$tp" Enter; sleep 3
tmux kill-session -t "=$s" 2>/dev/null || true

reg=$(ls -t "$conf"/projects/*/*.jsonl 2>/dev/null | head -1)
modelo=$(python3 -c '
import json,sys
for l in open(sys.argv[1]):
    d=json.loads(l)
    if d.get("type")=="assistant" and d["message"].get("model","").startswith("claude"): print(d["message"]["model"]); break' "$reg")
dest=$RES/anthropic_$modelo$sufijo/$cod
[ -e "$dest/meta.json" ] && { echo "Ya existe $dest"; exit 1; }
mkdir -p "$dest"; echo "$pantalla_final" > "$dest/pantalla.txt"
cp "$reg" "$dest/sesion.jsonl"; mv "$reg" "$reg.hecho"
rm -rf "$dest/salida"
if [ -n "${SEMILLA:-}" ]; then
  # Con semilla, salida/ guarda solo lo que el modelo creó o cambió; cambios.txt lista lo cambiado y lo borrado
  python3 "$B/scripts/salida-semilla.py" "$SEMILLA" "$ws" "$dest"
else cp -R "$ws" "$dest/salida"; fi
rm -rf "$ws"
python3 "$B/scripts/tokens-claude.py" "$dest" "$cod" "$modelo" "$inicio" "$prompt"
# Cuántas veces se le contestó «Decide tú.», en meta.json
python3 - "$dest/meta.json" "$pregunto" "$esf" "${SIN_ENCIERRO:-}" "$permisos" "${SEMILLA:-}" "${SIN_WEB:-}" "$fondo" <<'PY'
import json, sys
f = sys.argv[1]; m = json.load(open(f)); m["veces_decide_tu"] = int(sys.argv[2])
if sys.argv[6]: m["semilla"] = sys.argv[6]
if sys.argv[7]: m["sin_web"] = "WebSearch y WebFetch denegados en settings.json del aislado"
if int(sys.argv[5]): m["permisos_bloqueados"] = int(sys.argv[5])
if int(sys.argv[8]): m["espero_segundo_plano"] = True
if sys.argv[3]: m["esfuerzo"] = sys.argv[3]
if sys.argv[4]: m["aislamiento"] = ("Sin encierro.sh (excepción: Claude Code en la nube entra con la credencial de la sesión "
    "que lo dirige y el encierro la oculta). Configuración y HOME propios y carpeta aleatoria en /var/tmp/bench/, "
    "pero ve el resto del disco, incluido el repo. Revisado con scripts/fugas.py.")
json.dump(m, open(f, "w"), indent=2, ensure_ascii=False)
PY
