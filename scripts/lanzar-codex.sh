#!/usr/bin/env bash
# lanzar-codex.sh <CODIGO> <modelo> [esfuerzo]
#   lanzar-codex.sh CCA gpt-6.2-sol medium
#   lanzar-codex.sh CCA gpt-6.2-astra default      # «default»: no se pasa esfuerzo, el del modelo
# Como lanzar-claude.sh, pero con Codex CLI (codex exec, no interactivo): CODEX_HOME y HOME propios (solo se copia
# auth.json: sin config.toml, skills, AGENTS.md ni memorias de nadie; sin apps ni plugins de la cuenta, que traen MCP), carpeta vacía fuera del repo y un solo mensaje:
# el prompt tal cual + prompts/_destino.txt. Si acaba con una pregunta sin haber escrito nada, se reanuda la misma
# sesión con «Decide tú.» (como mucho 5 veces). Guarda lo mismo que lanzar.sh; sesion.jsonl es el registro de Codex.
# Excepción macOS: aquí no hay unshare, así que no va dentro de encierro.sh; lo encierra el sandbox de Codex con un
# perfil de permisos (abajo): solo lee su carpeta y lo mínimo para ejecutar herramientas, y tiene red. fugas.py revisa
# la sesión igual.
# SEC y TCI empiezan con un proyecto o un fichero en la carpeta (scripts/semilla.sh); SEC, además, sin búsqueda web
# (SIN_WEB=1 → web_search="disabled"). Los subagentes (spawn_agent) son registros aparte: van a subagentes/ y se suman.
set -eu
cod=$1 modelo=$2 esfuerzo=${3:-medium}
B=$(cd "$(dirname "$0")/.." && pwd)
# Destino: prompts/_destino.txt, salvo que el prompt traiga el suyo (<COD>.destino; vacío en TCI, cuyo prompt ya dice dónde guardar)
destino="$B/prompts/_destino.txt"; [ -f "$B/prompts/$cod.destino" ] && destino="$B/prompts/$cod.destino"
prompt="$(cat "$B/prompts/$cod.txt")"; [ -s "$destino" ] && prompt="$prompt $(cat "$destino")"
SEMILLA=${SEMILLA:-$("$B/scripts/semilla.sh" "$cod")}
[ "$cod" = SEC ] && SIN_WEB=${SIN_WEB:-1}
slug=openai_$(echo "$modelo" | tr '/:' '__')-$esfuerzo
dest=$B/resultados/$slug/$cod
[ -e "$dest/meta.json" ] && { echo "Ya existe $dest"; exit 1; }
base=${CODEX_BENCH:-$HOME/.codex-bench}/$slug
casa=$base/home; ch=$base/codex; mkdir -p "$casa" "$ch"
cp "$HOME/.codex/auth.json" "$ch/"
mkdir -p /var/tmp/bench; ws=$(mktemp -d /var/tmp/bench/ws-XXXXXXXX)
[ -n "$SEMILLA" ] && cp -a "$SEMILLA"/. "$ws"/
marca=$base/inicio-$cod; touch "$marca"  # «no ha escrito nada» = nada en la carpeta más nuevo que esta marca
codex=$(readlink -f "$(command -v codex)")  # la ruta real: el sandbox no deja seguir el enlace de ~/.local/bin
# Perfil de permisos «bench»: solo lee lo mínimo del sistema (:minimal), las herramientas (Homebrew, Command Line Tools,
# OpenSSL, la instalación de node) y su propia configuración sin auth.json; escribe solo en su carpeta y en su HOME.
# Ni /Users, ni el repo, ni otras pruebas, ni el /tmp de Claude. Codex le enseña esta lista al modelo: no nombra a nadie.
node_dir=$(dirname "$(dirname "$(readlink -f "$(command -v node)")")")
codex_dir=$(dirname "$(dirname "$(readlink -f "$codex")")")  # Codex se relanza a sí mismo dentro del sandbox
fs="\":minimal\"=\"read\",\":workspace_roots\"=\"write\",\"$ch\"=\"read\",\"$ch/auth.json\"=\"deny\",\"$casa\"=\"write\""
for p in /usr/local /opt/homebrew /Library/Developer/CommandLineTools /System/Library/OpenSSL /private/etc/ssl "$node_dir" "$codex" "$codex_dir"; do
  [ -e "$p" ] && fs="$fs,\"$p\"=\"read\""
done
[ -e "/private/tmp/claude-$(id -u)" ] && fs="$fs,\"/private/tmp/claude-$(id -u)\"=\"deny\""
ef=(); [ "$esfuerzo" = default ] || ef=(-c model_reasoning_effort="$esfuerzo")
[ -n "${SIN_WEB:-}" ] && ef+=(-c web_search='"disabled"')
corre() {  # corre <args de codex exec...>: entorno limpio, como una terminal recién abierta
  (cd "$ws" && env -i HOME="$casa" CODEX_HOME="$ch" PATH="$PATH" TERM=xterm-256color LANG=${LANG:-es_ES.UTF-8} SHELL=/bin/zsh \
    "$codex" exec --skip-git-repo-check -m "$modelo" ${ef[@]+"${ef[@]}"} \
    -c default_permissions='"bench"' -c "permissions.bench.filesystem={$fs}" -c permissions.bench.network.enabled=true \
    -c features.apps=false -c features.plugins=false -c features.remote_plugin=false "$@")
}
inicio=$(date -u +%Y-%m-%dT%H:%M:%SZ)
corre "$prompt" > "$base/salida-$cod.txt" 2>&1 < /dev/null || true
# La sesión principal: la más reciente lanzada por exec (los subagentes llevan parent_thread_id en session_meta)
principal() { for f in $(ls -t "$ch"/sessions/*/*/*/*.jsonl); do
  head -1 "$f" | grep -q '"parent_thread_id"' || { echo "$f"; return; }; done; }
reg=$(principal)
# Regla de las preguntas: si termina preguntando y no ha escrito nada, «Decide tú.» en la misma sesión
pregunto=0
while [ $pregunto -lt 5 ] && [ -z "$(find "$ws" -newer "$marca" -type f -print -quit)" ] && python3 - "$reg" <<'PY'
import json, sys
t = ""
for l in open(sys.argv[1]):
    x = json.loads(l); p = x.get("payload", {})
    if x["type"] == "response_item" and p.get("type") == "message" and p.get("role") == "assistant":
        t = " ".join(c.get("text", "") for c in p.get("content", []))
sys.exit(0 if "?" in t[-400:] else 1)
PY
do
  pregunto=$((pregunto + 1))
  corre resume --last "Decide tú." >> "$base/salida-$cod.txt" 2>&1 < /dev/null || true
done
mkdir -p "$dest"; cp "$base/salida-$cod.txt" "$dest/pantalla.txt"
cp "$reg" "$dest/sesion.jsonl"
# Subagentes: registros con parent_thread_id creados en esta prueba (más nuevos que la marca)
for f in $(find "$ch"/sessions -name '*.jsonl' -newer "$marca"); do
  [ "$f" = "$reg" ] && continue
  head -1 "$f" | grep -q '"parent_thread_id"' && { mkdir -p "$dest/subagentes"; cp "$f" "$dest/subagentes/"; mv "$f" "$f.hecho"; }
done
mv "$reg" "$reg.hecho"
rm -rf "$dest/salida"
if [ -n "$SEMILLA" ]; then python3 "$B/scripts/salida-semilla.py" "$SEMILLA" "$ws" "$dest"; else cp -R "$ws" "$dest/salida"; fi
rm -rf "$ws"
python3 "$B/scripts/tokens-codex.py" "$dest" "$cod" "$modelo" "$inicio" "$prompt" "$esfuerzo" "$pregunto"
if [ -n "$SEMILLA" ]; then python3 - "$dest/meta.json" "$SEMILLA" "${SIN_WEB:-}" <<'PY'
import json, sys
f = sys.argv[1]; m = json.load(open(f)); m["semilla"] = sys.argv[2]
if sys.argv[3]: m["sin_web"] = 'web_search="disabled" en la configuración de Codex'
json.dump(m, open(f, "w"), indent=2, ensure_ascii=False)
PY
fi
