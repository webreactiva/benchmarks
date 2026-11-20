#!/usr/bin/env bash
# tmux-agente.sh: maneja un agente de terminal dentro de tmux como lo haría una persona.
# La sesión de tmux mide 120 × 36 y se graba entera con asciinema (el .cast es lo único que guarda todo).
#
#   tmux-agente.sh claude   <sesion> <carpeta> [cast|-] [args]   Claude Code aislado (claude-aislado.sh --permission-mode auto);
#                                                                 pasa las pantallas de la primera vez (tema, avisos, confianza)
#   tmux-agente.sh opencode <sesion> <carpeta> [cast|-] [args]   OpenCode aislado (opencode-aislado.sh)
#   tmux-agente.sh arranca  <sesion> <carpeta> <cast|-> <comando> cualquier otro comando
#   tmux-agente.sh di       <sesion> <texto>     escribe el texto, Enter, espera a que acabe, guarda la pantalla y la enseña
#   tmux-agente.sh teclas   <sesion> <tecla>...  pulsa teclas (Enter, Down, Up, Right, Escape, C-c, S-Tab, 1…) y espera
#   tmux-agente.sh espera   <sesion>             espera a que el agente deje de trabajar
#   tmux-agente.sh mira     <sesion> [lineas]    enseña la pantalla, sin líneas vacías
#   tmux-agente.sh guarda   <sesion> [nombre]    guarda la pantalla y su historial con colores (.ansi, para pane-png.mjs)
#   tmux-agente.sh para     <sesion>             sale del agente (/exit o Ctrl+C), cierra tmux y dice dónde está el .cast
#
# Variables:
#   AGENTE_DIR    carpeta de las grabaciones (casts/) y las pantallas (pantallas/). Por defecto, ${TMPDIR:-/tmp}/agentes
#   LINEAS        líneas de pantalla que enseñan di, teclas y mira (40)
#   ACEPTA=1      en OpenCode, di y teclas aceptan cada "Permission required" con "Allow once" y lo apuntan en
#                 pantallas/<sesion>-permisos.txt
#   COLUMNAS, FILAS  tamaño de la terminal (120 × 36). Con menos columnas, las capturas salen con la letra más grande.
#   ESPERA_MAX    segundos máximos de espera (3600). Para esperas largas, lanza di o espera en segundo plano.
#   CLAUDE_LOOP_CONFIG, OPENCODE_AISLADO, OPENCODE_MODELO, CLAUDE_CODE_AUTO_COMPACT_WINDOW, CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION: se pasan a la sesión de tmux
#                 (ver claude-aislado.sh y opencode-aislado.sh)
#
# Al acabar, di, teclas y espera escriben una línea de estado:
#   == LIBRE     ya no sale el indicador de trabajo en tres vistazos seguidos, 5 s entre uno y otro
#   == DIALOGO   hay una pregunta o un permiso en pantalla: contesta con teclas
#   == FIN       la sesión de tmux se ha cerrado (el agente salió)
#   == TRABAJANDO se acabó ESPERA_MAX y sigue ocupado
set -u
aqui=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
dir_base=${AGENTE_DIR:-${TMPDIR:-/tmp}/agentes}
ocupado="esc to interrupt|esc interrupt|esc again to interrupt|Working\.\.\."  # el último, Pi
dialogo="Enter to (select|confirm)|Permission required|↑↓ select|Do you want to|Allow once"

uso() { awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 1; }
[ $# -ge 2 ] || uso
orden=$1 s=$2; shift 2
# Destinos exactos: "-t cc" también encontraría la sesión "cc2"; "=cc" solo "cc".
ts="=$s" tp="=$s:"

vivo() { tmux has-session -t "$ts" 2>/dev/null; }
pantalla() { tmux capture-pane -p -t "$tp" 2>/dev/null; }
opcion() { tmux show-options -v -t "$tp" "@$1" 2>/dev/null; }
enseña() { pantalla | grep -v '^[[:space:]]*$' | tail -n "${1:-${LINEAS:-40}}"; }

estado() {
  if ! vivo; then echo "== FIN"; return; fi
  if pantalla | grep -qE "$dialogo"; then echo "== DIALOGO"; else echo "== LIBRE"; fi
}

espera() {
  local q=0 t=0 max=${ESPERA_MAX:-3600}
  sleep 3
  while [ $q -lt 3 ]; do
    vivo || return 0
    [ $t -ge "$max" ] && { echo "== TRABAJANDO tras ${max} s"; return 2; }
    sleep 5; t=$((t + 5))
    if pantalla | grep -qiE "$ocupado"; then q=0; else q=$((q + 1)); fi
  done
}

guarda() {
  local d n f
  d=$(opcion pantallas); d=${d:-$dir_base/pantallas}; mkdir -p "$d"
  if [ -n "${1:-}" ]; then f="$d/$s-$1.ansi"; else
    n=$(ls "$d" 2>/dev/null | grep -c "^$s-[0-9]*\.ansi$"); f="$d/$s-$(printf %03d $((n + 1))).ansi"; fi
  tmux capture-pane -p -e -t "$tp" -S -3000 > "$f" && echo "$f"
}

acepta() {  # OpenCode: "Allow once" mientras pida permiso
  [ "${ACEPTA:-}" = 1 ] && [ "$(opcion agente)" = opencode ] || return 0
  local d; d=$(opcion pantallas); d=${d:-$dir_base/pantallas}; mkdir -p "$d"
  while vivo && pantalla | grep -q "Permission required"; do
    pantalla | grep -A3 "Permission required" | grep -v '^[[:space:]]*$' | sed -n '2,3p' >> "$d/$s-permisos.txt"
    tmux send-keys -t "$tp" Enter; espera
  done
}

arranca() {  # <carpeta> <cast|-> <agente> <comando>
  local carpeta=$1 cast=$2 agente=$3 cmd=$4
  [ -d "$carpeta" ] || { echo "No existe la carpeta $carpeta"; exit 1; }
  if [ "$cast" = - ] || [ -z "$cast" ]; then
    mkdir -p "$dir_base/casts"; cast="$dir_base/casts/$s-$(date +%Y%m%d-%H%M%S).cast"
  fi
  mkdir -p "$(dirname "$cast")"; cast=$(cd "$(dirname "$cast")" && pwd)/$(basename "$cast")
  tmux kill-session -t "$ts" 2>/dev/null
  # Si el servidor de tmux ya estaba en marcha, la sesión nueva no hereda las variables de este shell: se pasan con -e.
  local e=() v
  for v in CLAUDE_LOOP_CONFIG CLAUDE_CODE_AUTO_COMPACT_WINDOW CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION CLAUDE_CODE_DISABLE_BACKGROUND_TASKS OPENCODE_AISLADO OPENCODE_MODELO OLLAMA_CLOUD_API_KEY; do
    [ -n "${!v+x}" ] && e+=(-e "$v=${!v}"); done
  tmux new-session -d -s "$s" -x "${COLUMNAS:-120}" -y "${FILAS:-36}" -c "$carpeta" ${e[@]+"${e[@]}"} \
    "asciinema rec -q --overwrite --cols ${COLUMNAS:-120} --rows ${FILAS:-36} -c $(printf %q "$cmd") $(printf %q "$cast")"
  tmux set-option -t "$tp" @agente "$agente"
  tmux set-option -t "$tp" @cast "$cast"
  tmux set-option -t "$tp" @pantallas "$(dirname "$(dirname "$cast")")/pantallas"
  echo "== grabando en $cast"
}

case $orden in
  claude)
    [ $# -ge 1 ] || uso
    carpeta=$1 cast=${2:--}; shift; [ $# -gt 0 ] && shift
    cmd="$aqui/claude-aislado.sh --permission-mode auto"; for a in "$@"; do cmd+=" $(printf %q "$a")"; done
    arranca "$carpeta" "$cast" claude "$cmd"
    # Primera vez: tema (Enter), avisos de seguridad (Enter) y confianza en la carpeta, con "No, exit" marcado:
    # se baja hasta "❯ Yes" y solo entonces Enter. Un Enter antes de tiempo cierra Claude y la sesión de tmux.
    for i in $(seq 1 90); do
      sleep 1; vivo || { echo "== FIN: Claude se cerró al arrancar"; exit 1; }
      scr=$(pantalla)
      if echo "$scr" | grep -q "No, exit"; then
        sleep 1; tmux send-keys -t "$tp" Down
        for j in $(seq 1 20); do sleep 0.5; pantalla | grep -q "❯ Yes" && break; done
        pantalla | grep -q "❯ Yes" && tmux send-keys -t "$tp" Enter; sleep 3
      elif echo "$scr" | grep -qE "shift\+tab to cycle|\? for shortcuts"; then break
      elif echo "$scr" | grep -qiE "text style|Choose .*theme|Security notes|Press Enter to continue"; then
        sleep 1; tmux send-keys -t "$tp" Enter; sleep 2
      elif echo "$scr" | grep -qiE "login method|Select login|Paste code"; then
        echo "== Claude pide iniciar sesión: hazlo a mano con tmux attach -t $s"; enseña; exit 1
      fi
    done
    enseña 8 ;;
  opencode)
    [ $# -ge 1 ] || uso
    carpeta=$1 cast=${2:--}; shift; [ $# -gt 0 ] && shift
    cmd="$aqui/opencode-aislado.sh"; for a in "$@"; do cmd+=" $(printf %q "$a")"; done
    arranca "$carpeta" "$cast" opencode "$cmd"
    for i in $(seq 1 60); do sleep 1; vivo || { echo "== FIN: OpenCode se cerró al arrancar"; exit 1; }
      pantalla | grep -q "ctrl+p" && break; done
    sleep 2; enseña 8 ;;
  arranca)
    [ $# -ge 3 ] || uso
    arranca "$1" "$2" otro "$3"; sleep 5; enseña 8 ;;
  di)
    [ $# -ge 1 ] || uso
    vivo || { echo "== FIN: no hay sesión $s"; exit 1; }
    tmux send-keys -t "$tp" -l "$1"; sleep 1; tmux send-keys -t "$tp" Enter
    # OpenCode: un /comando abre el autocompletado; el primer Enter elige, el segundo envía.
    if [ "$(opcion agente)" = opencode ] && [ "${1:0:1}" = / ]; then sleep 1.5; tmux send-keys -t "$tp" Enter; fi
    espera; acepta
    vivo && { guarda >/dev/null; enseña; }; estado ;;
  teclas)
    [ $# -ge 1 ] || uso
    for k in "$@"; do tmux send-keys -t "$tp" "$k"; sleep 1; done
    espera; acepta
    vivo && enseña; estado ;;
  espera)
    espera; acepta; vivo && enseña; estado ;;
  mira)
    enseña "${1:-${LINEAS:-40}}" ;;
  guarda)
    guarda "${1:-}" ;;
  para)
    cast=$(opcion cast); agente=$(opcion agente)
    if vivo; then
      case $agente in
        claude) tmux send-keys -t "$tp" -l "/exit"; sleep 1; tmux send-keys -t "$tp" Enter ;;
        *) tmux send-keys -t "$tp" C-c ;;
      esac
      for i in $(seq 1 15); do sleep 1; vivo || break; done
      vivo && tmux kill-session -t "$ts"
    fi
    [ -n "$cast" ] && echo "== grabación: $cast ($(du -h "$cast" 2>/dev/null | cut -f1))" ;;
  *) uso ;;
esac
