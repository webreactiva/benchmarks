#!/usr/bin/env bash
# claude-aislado.sh [argumentos de claude]
# Lanza Claude Code como lo haría una persona en su terminal, sin heredar el entorno de la sesión que lo dirige:
# sin su identificador de sesión ni su canal de mensajes, sin sus credenciales (tokens de GitHub, AWS…) y con su propia
# carpeta de configuración (CLAUDE_CONFIG_DIR), para que /model, /effort y sus registros no se mezclen con los de fuera.
# Pasa solo lo necesario: red y certificados del proxy, la configuración de git del proxy, Playwright y la URL de la API.
# CLAUDE_CODE_AUTO_COMPACT_WINDOW (tokens de contexto a los que compacta solo) pasa si se da al lanzar; por defecto, 250000.
keep=(HOME PATH TERM LANG SHELL IS_SANDBOX
  HTTPS_PROXY https_proxy NO_PROXY no_proxy GLOBAL_AGENT_HTTPS_PROXY GLOBAL_AGENT_NO_PROXY npm_config_https_proxy npm_config_noproxy YARN_HTTPS_PROXY
  NODE_EXTRA_CA_CERTS SSL_CERT_FILE GIT_SSL_CAINFO CURL_CA_BUNDLE REQUESTS_CA_BUNDLE NIX_SSL_CERT_FILE
  GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 GIT_CONFIG_KEY_1 GIT_CONFIG_VALUE_1 GIT_CONFIG_KEY_2 GIT_CONFIG_VALUE_2
  PLAYWRIGHT_BROWSERS_PATH PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD ANTHROPIC_BASE_URL)
export CLAUDE_CODE_AUTO_COMPACT_WINDOW="${CLAUDE_CODE_AUTO_COMPACT_WINDOW:-250000}"
keep+=(CLAUDE_CODE_AUTO_COMPACT_WINDOW CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION CLAUDE_CODE_DISABLE_BACKGROUND_TASKS)
args=()
for v in "${keep[@]}"; do [ -n "${!v+x}" ] && args+=("$v=${!v}"); done
exec env -i "${args[@]}" CLAUDE_CONFIG_DIR="${CLAUDE_LOOP_CONFIG:-$HOME/.claude-loop}" claude "$@"
