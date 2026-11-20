#!/usr/bin/env bash
# lanzar-claude.sh <CODIGO> <modelo de Claude Code>
#   lanzar-claude.sh PTS haiku
# Como lanzar.sh, pero con Claude Code aislado (claude-aislado.sh, --permission-mode auto): configuración y HOME
# propios (sin skills, sin CLAUDE.md, sin ajustes de nadie), carpeta vacía fuera del repo y un solo mensaje:
# el prompt tal cual + prompts/_destino.txt. Guarda lo mismo que lanzar.sh; sesion.jsonl es el registro de Claude Code.
set -eu
cod=$1 alias=$2
B=$(cd "$(dirname "$0")/.." && pwd); R=$(cd "$B/.." && pwd)
# Herramientas: en el repositorio público van en herramientas/; aquí, en _comun/herramientas
if [ -d "$B/herramientas" ]; then H=$B/herramientas; else H=$R/_comun/herramientas; fi
prompt="$(cat "$B/prompts/$cod.txt") $(cat "$B/prompts/_destino.txt")"
base=${CLAUDE_BENCH:-$HOME/.claude-bench}
conf=$base/config; casa=$base/home; mkdir -p "$conf" "$casa"
# Carpeta con nombre aleatorio, que se borra al terminar: así ningún modelo encuentra el trabajo de otro
mkdir -p /var/tmp/bench; ws=$(mktemp -d /var/tmp/bench/ws-XXXXXXXX)
# Encerrado (scripts/encierro.sh): no ve el repo, ni /tmp, ni el resto de /root; el lanzador va en su configuración
cp "$H/claude-aislado.sh" "$base/"
s=c-$cod tp="=c-$cod:"
tmux kill-session -t "=$s" 2>/dev/null || true
tmux new-session -d -s "$s" -x 120 -y 36 -c "$ws" \
  "$B/scripts/encierro.sh $ws $base env HOME=$casa CLAUDE_LOOP_CONFIG=$conf $base/claude-aislado.sh --permission-mode auto --model $alias"
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
# Regla de las preguntas: el modelo decide siempre. Cada vez que pregunte, da opciones o pida que elijamos, se cierra
# la pregunta y se le contesta «Decide tú.» (como mucho 5 veces, para no entrar en un bucle)
pregunto=0
while [ $pregunto -lt 5 ] && tmux capture-pane -p -t "=$s:" 2>/dev/null | grep -qE "esc dismiss|Enter to select|↑↓ select|Type your own answer|Type something"; do
  pregunto=$((pregunto + 1))
  tmux send-keys -t "=$s:" Escape; sleep 3
  ACEPTA=1 ESPERA_MAX=${ESPERA_MAX:-2400} LINEAS=12 "$H/tmux-agente.sh" di "$s" "Decide tú." || true
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
dest=$B/resultados/anthropic_$modelo/$cod
[ -e "$dest/meta.json" ] && { echo "Ya existe $dest"; exit 1; }
mkdir -p "$dest"; echo "$pantalla_final" > "$dest/pantalla.txt"
cp "$reg" "$dest/sesion.jsonl"; mv "$reg" "$reg.hecho"
rm -rf "$dest/salida"; cp -R "$ws" "$dest/salida"; rm -rf "$ws"
python3 "$B/scripts/tokens-claude.py" "$dest" "$cod" "$modelo" "$inicio" "$prompt"
# Cuántas veces se le contestó «Decide tú.», en meta.json
python3 - "$dest/meta.json" "$pregunto" <<'PY'
import json, sys
f = sys.argv[1]; m = json.load(open(f)); m["veces_decide_tu"] = int(sys.argv[2]); json.dump(m, open(f, "w"), indent=2, ensure_ascii=False)
PY
