#!/usr/bin/env bash
# benchmark.sh [-p A3D,AIF,...] MODELO [MODELO...]
#   benchmark.sh nvidia/nemotron-3-ultra-550b-a55b:free haiku
#   benchmark.sh -p CCA,PTS sonnet google/gemma-4-31b-it:free
# Lanza los prompts (todos por defecto, en el orden de abajo) para cada modelo, uno detrás de otro.
# Un modelo con «/» va con OpenCode (lanzar.sh): «ollama/…» es de Ollama Cloud y el resto, de OpenRouter; haiku, sonnet, opus o claude-* van con
# Claude Code (lanzar-claude.sh, esfuerzo opcional en ESFUERZO); gpt-* va con Codex CLI (lanzar-codex.sh, esfuerzo en ESFUERZO, por defecto medium).
# Lo que ya tiene meta.json no se repite. Para al primer 429 de OpenRouter.
set -u
B=$(cd "$(dirname "$0")/.." && pwd)
prompts="A3D AIF CCA PTS SEC"
[ "${1:-}" = -p ] && { prompts=$(echo "$2" | tr ',' ' '); shift 2; }
[ $# -ge 1 ] || { sed -n '2,8p' "$0"; exit 1; }
for m in "$@"; do
  for c in $prompts; do
    if [[ $m == */* ]]; then
      slug=$(echo "$m" | tr '/:' '__')
      [ -e "$B/resultados/$slug/$c/meta.json" ] && { echo "### $m $c: ya hecho"; continue; }
      q=-; [[ $m == ollama/* ]] || q=$(curl -sS https://openrouter.ai/api/v1/key -H "Authorization: Bearer $OPEN_ROUTER_API_KEY" |
        python3 -c 'import json,sys; d=json.load(sys.stdin)["data"].get("free_model_daily_requests") or {}; print(d.get("remaining","?"))')
      [[ $m == *:free ]] && [ "$q" = 0 ] && { echo "### $m $c: cupo gratuito agotado, paro"; exit 2; }
      echo "### $m $c (cupo gratuito: $q)"; "$B/scripts/lanzar.sh" "$c" "$m" 2>&1 | tail -1
    elif [[ $m == gpt-* ]]; then
      e=${ESFUERZO:-medium}
      [ -e "$B/resultados/openai_$m-$e/$c/meta.json" ] && { echo "### $m $c: ya hecho"; continue; }
      echo "### $m ($e) $c"; "$B/scripts/lanzar-codex.sh" "$c" "$m" "$e" 2>&1 | tail -1
    else
      e=${ESFUERZO:-}; suf=""; [ -n "$e" ] && [ "$e" != default ] && suf="-$e"
      if [ -n "$suf" ]; then ls "$B"/resultados/anthropic_*"$m$suf"/"$c"/meta.json >/dev/null 2>&1
      else ls "$B"/resultados/anthropic_*"$m"/"$c"/meta.json >/dev/null 2>&1; fi && { echo "### $m${e:+ ($e)} $c: ya hecho"; continue; }
      echo "### $m${e:+ ($e)} $c"; "$B/scripts/lanzar-claude.sh" "$c" "$m" 2>&1 | tail -1
    fi
  done
done
