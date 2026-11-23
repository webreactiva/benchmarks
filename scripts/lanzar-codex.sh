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
set -eu
cod=$1 modelo=$2 esfuerzo=${3:-medium}
B=$(cd "$(dirname "$0")/.." && pwd)
prompt="$(cat "$B/prompts/$cod.txt") $(cat "$B/prompts/_destino.txt")"
slug=openai_$(echo "$modelo" | tr '/:' '__')-$esfuerzo
dest=$B/resultados/$slug/$cod
[ -e "$dest/meta.json" ] && { echo "Ya existe $dest"; exit 1; }
base=${CODEX_BENCH:-$HOME/.codex-bench}/$slug
casa=$base/home; ch=$base/codex; mkdir -p "$casa" "$ch"
cp "$HOME/.codex/auth.json" "$ch/"
mkdir -p /var/tmp/bench; ws=$(mktemp -d /var/tmp/bench/ws-XXXXXXXX)
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
corre() {  # corre <args de codex exec...>: entorno limpio, como una terminal recién abierta
  (cd "$ws" && env -i HOME="$casa" CODEX_HOME="$ch" PATH="$PATH" TERM=xterm-256color LANG=${LANG:-es_ES.UTF-8} SHELL=/bin/zsh \
    "$codex" exec --skip-git-repo-check -m "$modelo" ${ef[@]+"${ef[@]}"} \
    -c default_permissions='"bench"' -c "permissions.bench.filesystem={$fs}" -c permissions.bench.network.enabled=true \
    -c features.apps=false -c features.plugins=false -c features.remote_plugin=false "$@")
}
inicio=$(date -u +%Y-%m-%dT%H:%M:%SZ)
corre "$prompt" > "$base/salida-$cod.txt" 2>&1 < /dev/null || true
reg=$(ls -t "$ch"/sessions/*/*/*/*.jsonl | head -1)
# Regla de las preguntas: si termina preguntando y no ha escrito nada, «Decide tú.» en la misma sesión
pregunto=0
while [ $pregunto -lt 5 ] && [ -z "$(ls -A "$ws")" ] && python3 - "$reg" <<'PY'
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
cp "$reg" "$dest/sesion.jsonl"; mv "$reg" "$reg.hecho"
rm -rf "$dest/salida"; cp -R "$ws" "$dest/salida"; rm -rf "$ws"
python3 "$B/scripts/tokens-codex.py" "$dest" "$cod" "$modelo" "$inicio" "$prompt" "$esfuerzo" "$pregunto"
