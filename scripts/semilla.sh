#!/usr/bin/env bash
# semilla.sh <CODIGO>
# Escribe la ruta del proyecto que el agente recibe en su carpeta para ese prompt, o nada si el prompt empieza en una
# carpeta vacía. Si la copia no existe, la prepara. SEC: la tienda anonimizada (scripts/sec/preparar.py). TCI: las incidencias de Codex sin etiquetas (scripts/tci/).
# Va en $HOME/.cache/benchmark-semillas/, fuera del alcance del agente (el encierro tapa /root y /home; el sandbox de
# macOS, /Users). Allí también queda privado/ con el original: nunca dentro de la carpeta del agente.
set -eu
B=$(cd "$(dirname "$0")/.." && pwd)
case "$1" in
  SEC)
    d=$HOME/.cache/benchmark-semillas/SEC
    if [ ! -d "$d/semilla" ]; then
      rm -rf "$d"; mkdir -p "$(dirname "$d")"
      python3 "$B/scripts/sec/preparar.py" --out "$d" >&2
      # Aviso si la copia no es la misma que se usó en las pruebas publicadas
      if ! diff -q <(sed 's/^[0-9a-f]* //' "$B/scripts/sec/preparacion/v2/SHA256SUMS.txt" | sort) \
                   <(sed 's/^[0-9a-f]* //' "$d/privado/SHA256SUMS.txt" | sort) >/dev/null ||
         ! diff -q <(grep -v ' package-lock.json$' "$B/scripts/sec/preparacion/v2/SHA256SUMS.txt") \
                   <(grep -v ' package-lock.json$' "$d/privado/SHA256SUMS.txt") >/dev/null; then
        echo "AVISO: la copia de SEC no coincide con scripts/sec/preparacion/v2/SHA256SUMS.txt" >&2
      fi
    fi
    echo "$d/semilla" ;;
  TCI)
    # Solo las incidencias (id, título, texto), sin etiquetas: la respuesta correcta (jev) está en scripts/tci/
    d=$HOME/.cache/benchmark-semillas/TCI
    mkdir -p "$d/semilla" && cp "$B/scripts/tci/incidencias.jsonl" "$d/semilla/incidencias.jsonl"
    echo "$d/semilla" ;;
  *) ;;
esac
