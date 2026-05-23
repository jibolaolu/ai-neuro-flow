#!/usr/bin/env bash
# =============================================================================
# Neuro Flow — local development launcher (detailed)
# Similar workflow to nestiq/run_local.sh: env, venv, seed, Auth0, services.
#
# Usage:
#   bash ./run_local.sh
#   bash ./run_local.sh --skip-install
#   bash ./run_local.sh --setup-auth0
#   bash ./run_local.sh --open-browser
#   bash ./run_local.sh --tunnel
#
# Upstream: http://localhost:3004 (web) and http://localhost:8004 (API)
# nginx HTTPS: https://neuroflow.localtest.me:8443 (see docs/LOCAL_NGINX.md)
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$ROOT_DIR/ports.env" ]] && set -a && source "$ROOT_DIR/ports.env" && set +a
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
WORKERS_DIR="$ROOT_DIR/ai-workers"
SCRIPTS_DIR="$ROOT_DIR/scripts"

BACKEND_VENV="$BACKEND_DIR/.venv"
WORKERS_VENV="$WORKERS_DIR/.venv"

BACKEND_PORT="${NEUROFLOW_API_PORT:-8004}"
FRONTEND_PORT="${NEUROFLOW_WEB_PORT:-3004}"
BACKEND_HOST="0.0.0.0"
FRONTEND_HOST="0.0.0.0"

BACKEND_ENV_FILE="$BACKEND_DIR/.env"
FRONTEND_ENV_FILE="$FRONTEND_DIR/.env.local"
WORKERS_ENV_FILE="$WORKERS_DIR/.env"

SKIP_INSTALL=false
INCLUDE_WORKERS=false
OPEN_BROWSER=false
SETUP_AUTH0=false
TUNNEL=false
BACKEND_PID=""
FRONTEND_PID=""
TUNNEL_PID=""
BACKEND_PYTHON=""
WORKERS_PYTHON=""
FRONTEND_WAIT_TIMEOUT=180

_c_green='\033[32m'; _c_bright_green='\033[92m'; _c_yellow='\033[33m'
_c_cyan='\033[36m'; _c_red='\033[31m'; _c_bold='\033[1m'; _c_dim='\033[2m'; _c_reset='\033[0m'

_use_color() { [[ -t 1 ]] || [[ "${FORCE_COLOR:-0}" != "0" ]]; }
_col() { _use_color && printf "${1}${2}${_c_reset}" || printf '%s' "$2"; }

log() {
  printf '%s  %s  %s  %s  %s  %s %s\n' \
    "$(_col "${_c_bright_green}" "[Neuro Flow]")" "$$" \
    "$(_col "${_c_dim}" "-")" "$(_col "${_c_dim}" "$(date '+%-d/%m/%Y, %-I:%M:%S %p')")" \
    "$(_col "${_c_bold}${_c_green}" "    LOG")" "$(_col "${_c_yellow}" "[Bootstrap]")" "$1"
}

fail() {
  printf '%s  %s\n' "$(_col "${_c_red}" "[Neuro Flow ERROR]")" "$1" >&2
  exit 1
}

_print_banner() {
  local g="${_c_bright_green}"; local r="${_c_reset}"; local b="${_c_bold}"; local d="${_c_dim}"
  _use_color || { printf '\n  Neuro Flow  —  Local Development\n\n'; return; }
  printf '\n'
  printf "${g}${b}  ███╗   ██╗███████╗██╗   ██╗██████╗  ██████╗ ███████╗██╗      ██████╗ ██╗    ██╗${r}\n"
  printf "${g}${b}  ████╗  ██║██╔════╝██║   ██║██╔══██╗██╔═══██╗██╔════╝██║     ██╔═══██╗██║    ██║${r}\n"
  printf "${g}${b}  ██╔██╗ ██║█████╗  ██║   ██║██████╔╝██║   ██║█████╗  ██║     ██║   ██║██║ █╗ ██║${r}\n"
  printf "${g}${b}  ██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  ██║     ██║   ██║██║███╗██║${r}\n"
  printf "${g}${b}  ██║ ╚████║███████╗╚██████╔╝██║  ██║╚██████╔╝██║     ███████╗╚██████╔╝╚███╔███╔╝${r}\n"
  printf "${g}${b}  ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝${r}\n"
  printf '\n'
  printf "${d}  Clinical Platform  ·  Local Development${r}\n"
  printf '\n'
}

usage() {
  cat <<EOF
Usage: bash ./run_local.sh [options]

  --skip-install     Skip npm/pip install
  --include-workers  Install AI worker venv + deps
  --setup-auth0      Run scripts/setup-auth0.js after seed (needs M2M creds in .env)
  --open-browser     Open frontend when ready
  --tunnel           Cloudflare tunnel for Stripe/webhook testing
  --backend-port N   Default: 8004
  --frontend-port N  Default: 3004
  --help             This help
EOF
}

cleanup() {
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "$TUNNEL_PID" ]] && kill "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --skip-install) SKIP_INSTALL=true ;;
      --include-workers) INCLUDE_WORKERS=true ;;
      --setup-auth0) SETUP_AUTH0=true ;;
      --open-browser) OPEN_BROWSER=true ;;
      --tunnel) TUNNEL=true ;;
      --backend-port) shift; BACKEND_PORT="${1:?}" ;;
      --frontend-port) shift; FRONTEND_PORT="${1:?}" ;;
      --frontend-wait) shift; FRONTEND_WAIT_TIMEOUT="${1:?}" ;;
      --help) usage; exit 0 ;;
      *) fail "Unknown argument: $1" ;;
    esac
    shift
  done
}

require_command() { command -v "$1" >/dev/null 2>&1 || fail "Required: $1"; }

ensure_env_file() {
  local path="$1" label="$2" content="$3"
  if [[ ! -f "$path" ]]; then
    printf '%s\n' "$content" >"$path"
    log "Created $label: $path"
  fi
}

ensure_env_var() {
  local file="$1" key="$2" value="$3"
  grep -q "^${key}=" "$file" 2>/dev/null && return 0
  if [[ "$value" == "__generate__" ]]; then
    value=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    log "Generated $key"
  fi
  printf '%s=%s\n' "$key" "$value" >>"$file"
}

ensure_venv() {
  local venv="$1" label="$2"
  local py="$venv/bin/python"
  [[ -x "$venv/Scripts/python.exe" ]] && py="$venv/Scripts/python.exe"
  if [[ ! -x "$py" ]]; then
    log "Creating $label venv"
    rm -rf "$venv"
    python3 -m venv --copies "$venv"
  fi
}

resolve_python() {
  local venv="$1"
  for c in "$venv/bin/python" "$venv/Scripts/python.exe" python3; do
    [[ -x "$c" ]] && "$c" --version >/dev/null 2>&1 && { printf '%s' "$c"; return 0; }
  done
  return 1
}

seed_database() {
  log "Seeding database (orgs, users, demo clients)"
  (cd "$BACKEND_DIR" && "$BACKEND_PYTHON" -m app.seed)
}

setup_auth0_users() {
  if [[ ! -f "$SCRIPTS_DIR/setup-auth0.js" ]]; then
    log "scripts/setup-auth0.js not found — skip Auth0"
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    log "Node.js not found — skip Auth0 provisioning"
    return 0
  fi
  log "Provisioning Auth0 test users (optional)"
  node "$SCRIPTS_DIR/setup-auth0.js" || log "Auth0 setup failed (check AUTH0_MGMT_* in backend/.env)"
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${port}$"
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${port}$"
  else
    return 1
  fi
}

kill_port() {
  local port="$1"
  command -v fuser >/dev/null 2>&1 && fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  command -v lsof >/dev/null 2>&1 && lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 >/dev/null 2>&1 || true
}

wait_for_http() {
  local url="$1" label="$2" timeout="${3:-60}"
  local start=$(date +%s)
  while ! curl -sf --max-time 5 "$url" >/dev/null 2>&1; do
    (( $(date +%s) - start >= timeout )) && fail "$label not ready: $url"
    sleep 2
  done
  log "$label OK — $url"
}

_prefix_lines() {
  local tag="$1" color="$2"
  while IFS= read -r line; do
    _use_color && printf "\033[${color}m${tag}\033[0m  %s\n" "$line" || printf "${tag}  %s\n" "$line"
  done
}

start_apps() {
  log "Backend http://127.0.0.1:${BACKEND_PORT}"
  (cd "$BACKEND_DIR" && PORT="$BACKEND_PORT" "$BACKEND_PYTHON" -m uvicorn app.main:app \
    --host "$BACKEND_HOST" --port "$BACKEND_PORT" --no-access-log 2>&1 | _prefix_lines "[API]" "92") &
  BACKEND_PID=$!
  sleep 2
  log "Frontend http://127.0.0.1:${FRONTEND_PORT}"
  (cd "$FRONTEND_DIR" && npx next dev --hostname "$FRONTEND_HOST" --port "$FRONTEND_PORT" 2>&1 | _prefix_lines "[Web]" "36") &
  FRONTEND_PID=$!
}

main() {
  parse_args "$@"
  require_command python3
  require_command npm
  require_command curl
  [[ -d "$BACKEND_DIR" ]] || fail "Missing backend/"
  [[ -d "$FRONTEND_DIR" ]] || fail "Missing frontend/"

  _print_banner
  log "Preparing Neuro Flow"

  ensure_env_file "$BACKEND_ENV_FILE" "backend" "$(cat <<EOF
DATABASE_URL=sqlite:///./neuro_flow.db
ENVIRONMENT=development
LOG_LEVEL=INFO
PLATFORM_DISPLAY_NAME=Neuro Flow
PLATFORM_BASE_URL=http://localhost:${FRONTEND_PORT}
FRONTEND_URL=http://localhost:${FRONTEND_PORT}
SUPPORT_EMAIL=support@neuroflow.app
SENDGRID_FROM_EMAIL=noreply@neuroflow.app
ENABLE_LEGACY_WOOCOMMERCE_WEBHOOK=false
SIGNUP_TRIAL_DAYS=14
EOF
)"

  ensure_env_var "$BACKEND_ENV_FILE" "JWT_SECRET" "__generate__"
  ensure_env_var "$BACKEND_ENV_FILE" "WEBHOOK_SECRET" "__generate__"

  # Auth0 — application (SPA / regular web) + Management API (M2M for setup-auth0.js)
  ensure_env_var "$BACKEND_ENV_FILE" "AUTH0_DOMAIN" ""
  ensure_env_var "$BACKEND_ENV_FILE" "AUTH0_AUDIENCE" "https://neuroflow-api"
  ensure_env_var "$BACKEND_ENV_FILE" "AUTH0_CLIENT_ID" ""
  ensure_env_var "$BACKEND_ENV_FILE" "AUTH0_CLIENT_SECRET" ""
  ensure_env_var "$BACKEND_ENV_FILE" "AUTH0_MGMT_CLIENT_ID" ""
  ensure_env_var "$BACKEND_ENV_FILE" "AUTH0_MGMT_CLIENT_SECRET" ""
  ensure_env_var "$BACKEND_ENV_FILE" "AUTH0_CONNECTION" "Username-Password-Authentication"

  ensure_env_file "$FRONTEND_ENV_FILE" "frontend" "$(cat <<EOF
NEXT_PUBLIC_API_URL=
BACKEND_URL=http://127.0.0.1:${BACKEND_PORT}
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:${FRONTEND_PORT}
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=https://neuroflow-api
EOF
)"

  ensure_env_var "$FRONTEND_ENV_FILE" "AUTH0_SECRET" "__generate__"

  ensure_env_file "$WORKERS_ENV_FILE" "workers" "API_BASE_URL=http://127.0.0.1:${BACKEND_PORT}"

  ensure_venv "$BACKEND_VENV" "backend"
  BACKEND_PYTHON="$(resolve_python "$BACKEND_VENV")" || fail "No Python in venv"

  if [[ "$SKIP_INSTALL" != true ]]; then
    log "pip install (backend)"
    "$BACKEND_PYTHON" -m pip install -q -r "$BACKEND_DIR/requirements.txt"
    log "npm install (frontend)"
    npm install --prefix "$FRONTEND_DIR" --silent
    if [[ "$INCLUDE_WORKERS" == true ]]; then
      ensure_venv "$WORKERS_VENV" "workers"
      WORKERS_PYTHON="$(resolve_python "$WORKERS_VENV")"
      "$WORKERS_PYTHON" -m pip install -q -r "$WORKERS_DIR/requirements.txt"
    fi
  fi

  seed_database
  [[ "$SETUP_AUTH0" == true ]] && setup_auth0_users

  if [[ -x "$ROOT_DIR/scripts/check-ports.sh" ]]; then
    bash "$ROOT_DIR/scripts/check-ports.sh" || true
  fi
  [[ "$BACKEND_PORT" == "$FRONTEND_PORT" ]] && fail "Backend and frontend cannot share port $BACKEND_PORT"

  port_in_use "$BACKEND_PORT" && { kill_port "$BACKEND_PORT"; sleep 1; }
  port_in_use "$FRONTEND_PORT" && { kill_port "$FRONTEND_PORT"; sleep 1; }

  start_apps
  wait_for_http "http://127.0.0.1:${BACKEND_PORT}/health" "Backend" 90
  wait_for_http "http://127.0.0.1:${FRONTEND_PORT}" "Frontend" "$FRONTEND_WAIT_TIMEOUT"

  printf '\n'
  printf '  Frontend      http://localhost:%s\n' "$FRONTEND_PORT"
  printf '  API           http://localhost:%s\n' "$BACKEND_PORT"
  printf '  API docs      http://localhost:%s/docs\n' "$BACKEND_PORT"
  printf '  Sign up       http://localhost:%s/signup\n' "$FRONTEND_PORT"
  printf '  Subscription  http://localhost:%s/clinic-admin/subscription\n' "$FRONTEND_PORT"
  printf '\n'
  printf '  Test login (JWT): clinicaladmin@neuroflow.test / ClinicalAdmin@2024!\n'
  printf '  Mock roles:     http://localhost:%s/auth/mock?role=clinic-admin\n' "$FRONTEND_PORT"
  printf '\n'
  printf '  Auth0 users:    bash ./run_local.sh --setup-auth0\n'
  printf '  nginx HTTPS:    https://neuroflow.localtest.me:8443 (after localproxy setup)\n'
  printf '  Proxy refresh:  bash ~/Documents/localproxy/setup_local_https_proxy.sh --force\n'
  printf '\n'

  [[ "$OPEN_BROWSER" == true ]] && command -v xdg-open >/dev/null && xdg-open "http://localhost:${FRONTEND_PORT}" || true

  log "Ctrl+C to stop"
  wait -n "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

main "$@"
