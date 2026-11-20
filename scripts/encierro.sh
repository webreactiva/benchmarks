#!/usr/bin/env bash
# encierro.sh <carpeta-de-trabajo> <dir-config> <comando> [args...]
# Ejecuta el agente en su propio espacio de montajes y de procesos (unshare), para que no pueda ver nada más que su
# carpeta de trabajo y su configuración:
#   /home, /mnt vacíos     (ni el repo con los resultados de otros modelos, ni skills ni cuentas del sistema)
#   /tmp        vacío      (ni las carpetas de trabajo de otros, ni el scratchpad de quien lo dirige)
#   /root       vacío salvo .ccr (certificados del proxy, solo lectura) y <dir-config> (su configuración)
#   /proc       solo sus procesos
# La carpeta de trabajo vive en /var/tmp/bench/ws-XXXX y se vuelve a montar en la misma ruta.
set -eu
ws=$1 conf=$2; shift 2
# Excepción macOS (no hay unshare): sandbox-exec, como el perfil mínimo de Codex. No lee nada de /Users salvo su
# configuración y las herramientas (node, que lleva OpenCode); no ve otras carpetas de /var/tmp/bench ni el /tmp de
# Claude; escribe solo en su carpeta y en su configuración. El resto del sistema (/usr, /Library, /opt) se lee.
if [ "$(uname)" = Darwin ]; then
  r() { python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1"; }
  herr=$(dirname "$(dirname "$(r "$(command -v node)")")")
  perfil="(version 1)(allow default)
(deny file-read-data file-write* (subpath \"/Users\") (subpath \"$(r /var/tmp/bench)\") (subpath \"/private/tmp/claude-$(id -u)\"))
(allow file-read-data (subpath \"$herr\"))
(allow file-read-data file-write* (subpath \"$(r "$ws")\") (subpath \"$(r "$conf")\"))"
  # macOS no deja ejecutar binarios setuid dentro del sandbox y OpenCode llama a ps: una copia sin setuid delante
  mkdir -p "$conf/.bin" && cp /bin/ps "$conf/.bin/ps" && export PATH="$conf/.bin:$PATH"
  cd "$ws"
  exec sandbox-exec -p "$perfil" "$@"
fi
[ "$(id -u)" = 0 ] || { echo "encierro.sh necesita root"; exit 1; }
exec unshare --mount --propagation private --pid --fork --mount-proc bash -c '
  set -e
  ws=$1 conf=$2; shift 2
  mkdir -p /run/.enc/ws /run/.enc/conf /run/.enc/ccr
  mount --rbind "$ws" /run/.enc/ws
  mount --rbind "$conf" /run/.enc/conf
  mount --rbind /root/.ccr /run/.enc/ccr
  mount -t tmpfs tmpfs /var/tmp/bench
  mount -t tmpfs tmpfs /home
  mount -t tmpfs tmpfs /mnt
  mount -t tmpfs tmpfs /tmp && chmod 1777 /tmp
  mount -t tmpfs tmpfs /root
  mkdir -p "$ws" "$conf" /root/.ccr
  mount --move /run/.enc/ws "$ws"
  mount --move /run/.enc/conf "$conf"
  mount --move /run/.enc/ccr /root/.ccr && mount -o remount,bind,ro /root/.ccr
  cd "$ws"
  exec "$@"
' encierro "$ws" "$conf" "$@"
