#!/usr/bin/env bash
# opencode-aislado.sh [argumentos de opencode]
# Lanza OpenCode como lo haría una persona en su terminal, sin heredar el entorno de la sesión que lo dirige:
# sin sus variables ni sus credenciales (tokens de GitHub, AWS…) y con sus propias carpetas de configuración, datos,
# estado y caché (XDG_*_HOME bajo OPENCODE_AISLADO, por defecto ~/.opencode-aislado). Así no lee ni escribe
# ~/.config/opencode ni las sesiones de ~/.local/share/opencode.
# Pasa solo lo necesario: red y certificados del proxy, la configuración de git del proxy y OLLAMA_CLOUD_API_KEY.
# La primera vez escribe un opencode.json con el proveedor ollama-cloud (DeepSeek V4.1 Flash) y permisos de prueba.
# Con OPENCODE_MODELO=proveedor/modelo se cambia el modelo de ese primer opencode.json.
base="${OPENCODE_AISLADO:-$HOME/.opencode-aislado}"
conf="$base/config/opencode/opencode.json"
mkdir -p "$base/config/opencode" "$base/data" "$base/state" "$base/cache"
if [ ! -f "$conf" ]; then
  # Un modelo de ollama-cloud que no sea el de por defecto tiene que estar en la lista del proveedor
  id=${OPENCODE_MODELO#ollama-cloud/}; extra=""
  [ -n "${OPENCODE_MODELO:-}" ] && [ "$id" != "$OPENCODE_MODELO" ] && [ "$id" != deepseek-v4.1-flash ] && extra=",
        \"$id\": { \"name\": \"$id\" }"
  cat > "$conf" <<JSON
{
  "\$schema": "https://opencode.ai/config.json",
  "autoupdate": false,
  "provider": {
    "ollama-cloud": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama Cloud",
      "options": {
        "baseURL": "https://ollama.com/v1",
        "apiKey": "{env:OLLAMA_CLOUD_API_KEY}"
      },
      "models": {
        "deepseek-v4.1-flash": { "name": "DeepSeek V4.1 Flash" }$extra
      }
    }
  },
  "model": "${OPENCODE_MODELO:-ollama-cloud/deepseek-v4.1-flash}",
  "permission": {
    "edit": "allow",
    "bash": {
      "*": "ask",
      "git *": "allow",
      "node *": "allow",
      "npm *": "allow",
      "ls*": "allow",
      "cat *": "allow",
      "date*": "allow",
      "mkdir *": "allow",
      "grep *": "allow",
      "wc *": "allow",
      "head *": "allow",
      "sed -n*": "allow",
      "find *": "allow",
      ".specify/scripts/bash/*": "allow",
      "bash .specify/scripts/bash/*": "allow"
    }
  }
}
JSON
fi
keep=(HOME PATH TERM LANG SHELL IS_SANDBOX COLORTERM
  HTTPS_PROXY https_proxy HTTP_PROXY http_proxy NO_PROXY no_proxy GLOBAL_AGENT_HTTPS_PROXY GLOBAL_AGENT_NO_PROXY
  npm_config_https_proxy npm_config_noproxy YARN_HTTPS_PROXY
  NODE_EXTRA_CA_CERTS SSL_CERT_FILE GIT_SSL_CAINFO CURL_CA_BUNDLE REQUESTS_CA_BUNDLE NIX_SSL_CERT_FILE
  GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 GIT_CONFIG_KEY_1 GIT_CONFIG_VALUE_1 GIT_CONFIG_KEY_2 GIT_CONFIG_VALUE_2
  OLLAMA_CLOUD_API_KEY OPEN_ROUTER_API_KEY OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX)
args=()
for v in "${keep[@]}"; do [ -n "${!v+x}" ] && args+=("$v=${!v}"); done
# OpenCode 2.x arranca un servicio compartido en un puerto fijo: con --standalone cada instancia lleva su propio servidor
# (no choca con el OpenCode de quien dirige ni con el de otro modelo). La 1.x no tiene esa opción.
extra=(); opencode --help 2>/dev/null | grep -q -- --standalone && extra=(--standalone)
exec env -i "${args[@]}" \
  XDG_CONFIG_HOME="$base/config" XDG_DATA_HOME="$base/data" XDG_STATE_HOME="$base/state" XDG_CACHE_HOME="$base/cache" \
  OPENCODE_DISABLE_AUTOUPDATE=1 \
  opencode ${extra[@]+"${extra[@]}"} "$@"
