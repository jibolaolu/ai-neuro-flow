#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$ROOT_DIR/ports.env" ]] && set -a && source "$ROOT_DIR/ports.env" && set +a
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
WORKERS_DIR="$ROOT_DIR/ai-workers"

BACKEND_VENV="$BACKEND_DIR/.venv"
WORKERS_VENV="$WORKERS_DIR/.venv"

BACKEND_PORT="${NEUROFLOW_API_PORT:-${NEUROACCESS_API_PORT:-8004}}"
FRONTEND_PORT="${NEUROFLOW_WEB_PORT:-${NEUROACCESS_WEB_PORT:-3004}}"
BACKEND_HOST="0.0.0.0"
FRONTEND_HOST="0.0.0.0"

BACKEND_ENV_FILE="$BACKEND_DIR/.env"
FRONTEND_ENV_FILE="$FRONTEND_DIR/.env.local"
WORKERS_ENV_FILE="$WORKERS_DIR/.env"

SKIP_INSTALL=false
INCLUDE_WORKERS=false
OPEN_BROWSER=false
TUNNEL=false
BACKEND_PID=""
FRONTEND_PID=""
TUNNEL_PID=""
BACKEND_PYTHON=""
WORKERS_PYTHON=""
FRONTEND_WAIT_TIMEOUT=180

# ── ANSI colours ──────────────────────────────────────────────────────────────
_c_reset='\033[0m'
_c_bold='\033[1m'
_c_dim='\033[2m'
_c_green='\033[32m'
_c_bright_green='\033[92m'
_c_yellow='\033[33m'
_c_cyan='\033[36m'
_c_magenta='\033[35m'
_c_red='\033[31m'
_c_bright_red='\033[91m'
_c_white='\033[97m'

_use_color() {
  [[ -t 1 ]] || [[ "${FORCE_COLOR:-0}" != "0" && "${FORCE_COLOR:-0}" != "false" ]]
}

_col() { _use_color && printf "${1}${2}${_c_reset}" || printf '%s' "$2"; }

log() {
  local tag
  tag="$(_col "${_c_bright_green}" "[NeuroAccess]")"
  local pid
  pid="$(_col "${_c_green}" "$$")"
  local sep
  sep="$(_col "${_c_dim}" "-")"
  local ts
  ts="$(_col "${_c_dim}" "$(date '+%-d/%m/%Y, %-I:%M:%S %p')")"
  local lvl
  lvl="$(_col "${_c_bold}${_c_green}" "    LOG")"
  local ctx
  ctx="$(_col "${_c_yellow}" "[Bootstrap]")"
  printf '%s  %s  %s  %s  %s  %s %s\n' \
    "$tag" "$pid" "$sep" "$ts" "$lvl" "$ctx" "$1"
}

fail() {
  local tag
  tag="$(_col "${_c_bright_green}" "[NeuroAccess]")"
  local pid
  pid="$(_col "${_c_green}" "$$")"
  local sep
  sep="$(_col "${_c_dim}" "-")"
  local ts
  ts="$(_col "${_c_dim}" "$(date '+%-d/%m/%Y, %-I:%M:%S %p')")"
  local lvl
  lvl="$(_col "${_c_bold}${_c_red}" "  ERROR")"
  local ctx
  ctx="$(_col "${_c_yellow}" "[Bootstrap]")"
  printf '%s  %s  %s  %s  %s  %s %s\n' \
    "$tag" "$pid" "$sep" "$ts" "$lvl" "$ctx" "$1" >&2
  exit 1
}

_print_banner() {
  local g="${_c_bright_green}"; local r="${_c_reset}"; local b="${_c_bold}"; local d="${_c_dim}"
  _use_color || { printf '\n  NeuroAccess  —  Local Development\n\n'; return; }
  printf '\n'
  printf "${g}${b}  ███╗   ██╗███████╗██╗   ██╗██████╗  ██████╗ ${r}\n"
  printf "${g}${b}  ████╗  ██║██╔════╝██║   ██║██╔══██╗██╔═══██╗${r}\n"
  printf "${g}${b}  ██╔██╗ ██║█████╗  ██║   ██║██████╔╝██║   ██║${r}\n"
  printf "${g}${b}  ██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██║   ██║${r}\n"
  printf "${g}${b}  ██║ ╚████║███████╗╚██████╔╝██║  ██║╚██████╔╝${r}\n"
  printf "${g}${b}  ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ${r}\n"
  printf '\n'
  printf "${d}  Clinical Platform  ·  Local Development${r}\n"
  printf '\n'
}

usage() {
  cat <<EOF
Usage: bash ./run-local.sh [options]

Options:
  --skip-install      Skip npm/pip installation after the first run
  --include-workers   Create worker venv and install worker dependencies too
  --open-browser      Open the frontend URL when startup checks complete
  --backend-port N    Override backend port (default: 8004)
  --frontend-port N   Override frontend port (default: 3004)
  --frontend-wait N   Seconds to wait for Next.js to become ready (default: 180)
  --tunnel            Start a Cloudflare tunnel and print the public webhook URL
  --help              Show this help message
EOF
}

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "$TUNNEL_PID" ]] && kill -0 "$TUNNEL_PID" >/dev/null 2>&1; then
    kill "$TUNNEL_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --skip-install)
        SKIP_INSTALL=true
        ;;
      --include-workers)
        INCLUDE_WORKERS=true
        ;;
      --open-browser)
        OPEN_BROWSER=true
        ;;
      --backend-port)
        shift
        [[ $# -gt 0 ]] || fail "Missing value for --backend-port"
        BACKEND_PORT="$1"
        ;;
      --frontend-port)
        shift
        [[ $# -gt 0 ]] || fail "Missing value for --frontend-port"
        FRONTEND_PORT="$1"
        ;;
      --frontend-wait)
        shift
        [[ $# -gt 0 ]] || fail "Missing value for --frontend-wait"
        FRONTEND_WAIT_TIMEOUT="$1"
        ;;
      --tunnel)
        TUNNEL=true
        ;;
      --help)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
    shift
  done
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

require_dir() {
  [[ -d "$1" ]] || fail "Directory not found: $1"
}

ensure_env_file() {
  local path="$1"
  local label="$2"
  local content="$3"

  if [[ ! -f "$path" ]]; then
    printf '%s\n' "$content" >"$path"
    log "Created default $label file: $path"
  else
    log "$label file already exists: $path"
  fi
}

# Append a KEY=value line to an env file only if the key is absent.
# If value is "__generate__", a random 32-byte hex secret is created.
ensure_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"

  if grep -q "^${key}=" "$file" 2>/dev/null; then
    return 0
  fi

  if [[ "$value" == "__generate__" ]]; then
    value=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    log "Generated ${key}"
  fi

  printf '%s=%s\n' "$key" "$value" >>"$file"
}

seed_database() {
  log "Seeding test users"
  (
    cd "$BACKEND_DIR"
    "$BACKEND_PYTHON" -m app.seed
  )
}

start_tunnel() {
  if ! command -v cloudflared >/dev/null 2>&1; then
    log "cloudflared not found — tunnel skipped."
    log "  Install: winget install Cloudflare.cloudflared  (or download from cloudflare.com)"
    return 0
  fi

  log "Starting Cloudflare tunnel on port ${BACKEND_PORT} …"
  # cloudflared prints the public URL to stderr — capture and echo it
  cloudflared tunnel --url "http://localhost:${BACKEND_PORT}" 2>&1 | \
    while IFS= read -r line; do
      if [[ "$line" =~ https://[a-z0-9-]+\.trycloudflare\.com ]]; then
        TUNNEL_URL="${BASH_REMATCH[0]}"
        echo ""
        echo "┌─────────────────────────────────────────────────────────────┐"
        echo "│  Cloudflare tunnel active                                   │"
        echo "│  Public URL:  ${TUNNEL_URL}"
        echo "│                                                             │"
        echo "│  WordPress webhook delivery URL:                            │"
        echo "│  ${TUNNEL_URL}/api/v1/webhooks/payment"
        echo "│                                                             │"
        echo "│  Paste the URL above into:                                  │"
        echo "│  WooCommerce → Settings → Advanced → Webhooks → Add webhook │"
        echo "└─────────────────────────────────────────────────────────────┘"
        echo ""
      fi
    done &
  TUNNEL_PID=$!
  sleep 8  # give tunnel time to negotiate
}

ensure_venv() {
  local venv_path="$1"
  local python_path="$2"
  local label="$3"

  if [[ ! -x "$python_path" ]]; then
    if [[ -d "$venv_path" ]]; then
      log "Removing incomplete $label virtual environment"
      rm -rf "$venv_path"
    fi

    log "Creating $label virtual environment"
    python3 -m venv --copies "$venv_path"
  else
    log "$label virtual environment already exists"
  fi
}

resolve_python() {
  local venv_path="$1"
  local candidates=()

  if [[ -x "$venv_path/bin/python" ]]; then
    candidates+=("$venv_path/bin/python")
  fi

  if [[ -x "$venv_path/Scripts/python.exe" ]]; then
    candidates+=("$venv_path/Scripts/python.exe")
  fi

  if command -v python3 >/dev/null 2>&1; then
    candidates+=("python3")
  fi

  local candidate
  for candidate in "${candidates[@]}"; do
    if ! "$candidate" --version >/dev/null 2>&1; then
      continue
    fi

    printf '%s' "$candidate"
    return 0
  done

  return 1
}

assert_backend_import() {
  (
    cd "$BACKEND_DIR"
    "$BACKEND_PYTHON" - <<'PY' >/dev/null
import app.main
PY
  ) || fail "Backend dependencies installed but app.main still cannot be imported"
}

port_in_use() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${port}$"
    return
  fi

  if command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${port}$"
    return
  fi

  return 1
}

kill_port() {
  local port="$1"

  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 >/dev/null 2>&1 || true
  fi
}

ensure_ports() {
  [[ "$BACKEND_PORT" != "$FRONTEND_PORT" ]] || fail "Backend and frontend ports must be different"

  if port_in_use "$BACKEND_PORT"; then
    log "Reclaiming backend port $BACKEND_PORT"
    kill_port "$BACKEND_PORT"
    sleep 1
  fi

  if port_in_use "$FRONTEND_PORT"; then
    log "Reclaiming frontend port $FRONTEND_PORT"
    kill_port "$FRONTEND_PORT"
    sleep 1
  fi

  if port_in_use "$BACKEND_PORT"; then
    fail "Backend port $BACKEND_PORT is still in use"
  fi

  if port_in_use "$FRONTEND_PORT"; then
    fail "Frontend port $FRONTEND_PORT is still in use"
  fi

  return 0
}

install_backend_dependencies() {
  log "Installing backend dependencies"
  "$BACKEND_PYTHON" -m pip install -r "$BACKEND_DIR/requirements.txt"
}

install_frontend_dependencies() {
  log "Installing frontend dependencies"
  npm install --prefix "$FRONTEND_DIR"
}

install_worker_dependencies() {
  log "Installing AI worker dependencies"
  "$WORKERS_PYTHON" -m pip install -r "$WORKERS_DIR/requirements.txt"
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local timeout="${3:-60}"
  local start_time
  start_time="$(date +%s)"

  while true; do
    if curl --silent --fail --max-time 5 "$url" >/dev/null 2>&1; then
      log "$label responded at $url"
      return 0
    fi

    if (( "$(date +%s)" - start_time >= timeout )); then
      fail "$label did not become ready at $url within ${timeout}s"
    fi

    sleep 2
  done
}

open_browser() {
  local url="$1"

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
    return
  fi

  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
    return
  fi

  log "Could not find a browser opener command. Open $url manually."
}

_prefix_lines() {
  # Pipe stdin, prepending a coloured service label to every line.
  # Usage: some_command 2>&1 | _prefix_lines "[API]" "35"   (35 = magenta)
  local label="$1"
  local colour_code="$2"
  local tag
  if _use_color; then
    tag="\033[${colour_code}m${label}\033[0m"
  else
    tag="$label"
  fi
  while IFS= read -r line; do
    printf "${tag}  %s\n" "$line"
  done
}

start_apps() {
  log "Starting backend on http://localhost:${BACKEND_PORT}"
  (
    cd "$BACKEND_DIR"
    PORT="$BACKEND_PORT" "$BACKEND_PYTHON" -m uvicorn app.main:app \
      --host "$BACKEND_HOST" \
      --port "$BACKEND_PORT" \
      --no-access-log \
      2>&1 | _prefix_lines "[NeuroAccess]" "92"
  ) &
  BACKEND_PID=$!

  sleep 3

  log "Starting frontend on http://localhost:${FRONTEND_PORT}"
  (
    cd "$FRONTEND_DIR"
    npx next dev --hostname "$FRONTEND_HOST" --port "$FRONTEND_PORT" 2>&1 | \
      _prefix_lines "[Next.js]" "36"
  ) &
  FRONTEND_PID=$!
}

main() {
  parse_args "$@"

  require_command python3
  require_command npm
  require_command curl
  require_dir "$BACKEND_DIR"
  require_dir "$FRONTEND_DIR"
  require_dir "$WORKERS_DIR"

  _print_banner
  log "Preparing NeuroAccess local environment"

  ensure_env_file "$BACKEND_ENV_FILE" "backend" \
"DATABASE_URL=sqlite:///./neuroaccess.db
OPENAI_MODEL=gpt-4o-mini
LOG_LEVEL=INFO
ENVIRONMENT=development
FRONTEND_URL=http://localhost:${FRONTEND_PORT}
WORDPRESS_STAGING_URL=
WORDPRESS_PRODUCTION_URL="

  # Auto-generate secrets if not already in .env
  ensure_env_var "$BACKEND_ENV_FILE" "JWT_SECRET"      "__generate__"
  ensure_env_var "$BACKEND_ENV_FILE" "WEBHOOK_SECRET"  "__generate__"

  # Auth0 — fill these values once you create an Auth0 tenant
  ensure_env_var "$BACKEND_ENV_FILE" "AUTH0_DOMAIN"        ""
  ensure_env_var "$BACKEND_ENV_FILE" "AUTH0_AUDIENCE"      ""

  ensure_env_file "$FRONTEND_ENV_FILE" "frontend" \
"NEXT_PUBLIC_API_URL=
BACKEND_URL=http://localhost:${BACKEND_PORT}
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:${FRONTEND_PORT}
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE="

  ensure_env_file "$WORKERS_ENV_FILE" "AI worker" "API_BASE_URL=http://localhost:${BACKEND_PORT}"

  ensure_venv "$BACKEND_VENV" "$BACKEND_VENV/bin/python" "backend"
  BACKEND_PYTHON="$(resolve_python "$BACKEND_VENV" || true)"
  [[ -n "$BACKEND_PYTHON" ]] || fail "Could not find a backend Python interpreter"

  if [[ "$INCLUDE_WORKERS" == true ]]; then
    ensure_venv "$WORKERS_VENV" "$WORKERS_VENV/bin/python" "AI worker"
    WORKERS_PYTHON="$(resolve_python "$WORKERS_VENV" || true)"
    [[ -n "$WORKERS_PYTHON" ]] || fail "Could not find an AI worker Python interpreter"
  fi

  if [[ "$SKIP_INSTALL" != true ]]; then
    install_backend_dependencies
    install_frontend_dependencies

    if [[ "$INCLUDE_WORKERS" == true ]]; then
      install_worker_dependencies
    fi
  else
    log "Skipping dependency installation because --skip-install was provided"
  fi

  seed_database

  log "Validating backend import"
  assert_backend_import

  log "Checking local ports"
  if [[ -x "$ROOT_DIR/scripts/check-ports.sh" ]]; then
    bash "$ROOT_DIR/scripts/check-ports.sh" || true
  fi
  ensure_ports
  log "Launching services"
  start_apps

  wait_for_http "http://localhost:${BACKEND_PORT}/health" "Backend health check" 60
  wait_for_http "http://localhost:${FRONTEND_PORT}" "Frontend app" "$FRONTEND_WAIT_TIMEOUT"

  if [[ "$TUNNEL" == true ]]; then
    start_tunnel
  fi

  log "All services started"
  printf '\n'
  _use_color && printf "${_c_bold}${_c_bright_green}" || true
  printf '  ┌──────────────────────────────────────────────────────────────┐\n'
  printf '  │                  NeuroAccess  —  Running                     │\n'
  printf '  ├──────────────────────────────────────────────────────────────┤\n'
  _use_color && printf "${_c_reset}" || true

  _url() { _use_color && printf "${_c_cyan}${1}${_c_reset}" || printf '%s' "$1"; }
  _lbl() { _use_color && printf "${_c_dim}%-18s${_c_reset}" "$1" || printf '%-18s' "$1"; }

  printf '  │  %s  %s  │\n' "$(_lbl "Frontend")"     "$(_url "http://localhost:${FRONTEND_PORT}              ")"
  printf '  │  %s  %s  │\n' "$(_lbl "API docs")"      "$(_url "http://localhost:${BACKEND_PORT}/docs          ")"
  printf '  │  %s  %s  │\n' "$(_lbl "Health check")"  "$(_url "http://localhost:${BACKEND_PORT}/health        ")"
  printf '  │  %s  %s  │\n' "$(_lbl "Auth (mock)")"   "$(_url "http://localhost:${FRONTEND_PORT}/auth/mock    ")"
  _use_color && printf "${_c_bright_green}${_c_bold}" || true
  printf '  ├──────────────────────────────────────────────────────────────┤\n'
  _use_color && printf "${_c_reset}${_c_dim}" || true
  printf '  │  Quick rerun:   bash ./dont-run-local.sh --skip-install           │\n'
  printf '  │  With tunnel:   bash ./dont-run-local.sh --skip-install --tunnel  │\n'
  printf '  │  Stop:          Ctrl+C                                       │\n'
  _use_color && printf "${_c_bright_green}${_c_bold}" || true
  printf '  └──────────────────────────────────────────────────────────────┘\n'
  _use_color && printf "${_c_reset}" || true
  printf '\n'

  if [[ "$INCLUDE_WORKERS" == true ]]; then
    log "AI worker example:  \"$WORKERS_PYTHON\" \"$WORKERS_DIR/workers/report_generator.py\""
  fi

  if [[ "$OPEN_BROWSER" == true ]]; then
    open_browser "http://localhost:${FRONTEND_PORT}"
  fi

  log "Press Ctrl+C to stop all services"
  wait -n "$BACKEND_PID" "$FRONTEND_PID" || true
}

main "$@"
