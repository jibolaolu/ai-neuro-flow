#!/usr/bin/env bash
# Verify Neuro Flow port configuration has no internal clashes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$ROOT/ports.env" ]] && set -a && source "$ROOT/ports.env" && set +a

WEB="${NEUROFLOW_WEB_PORT:-3004}"
API="${NEUROFLOW_API_PORT:-8004}"
NEST_WEB="${NESTIQ_WEB_PORT:-3000}"
NEST_API="${NESTIQ_API_PORT:-8000}"

errors=0
warn() { printf '\033[33m[ports]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[31m[ports]\033[0m %s\n' "$*" >&2; errors=$((errors + 1)); }

if [[ "$WEB" == "$API" ]]; then
  fail "NEUROFLOW_WEB_PORT and NEUROFLOW_API_PORT must differ (both are $WEB)"
fi

if [[ "$WEB" == "$NEST_WEB" || "$WEB" == "$NEST_API" || "$API" == "$NEST_WEB" || "$API" == "$NEST_API" ]]; then
  fail "Neuro Flow ports ($WEB, $API) overlap Nestiq ports ($NEST_WEB, $NEST_API) — change one stack in ports.env"
fi

port_listening() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${port}$"
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${port}$"
  else
    return 1
  fi
}

for label_port in "Neuro Flow web:$WEB" "Neuro Flow API:$API"; do
  label="${label_port%%:*}"
  port="${label_port##*:}"
  if port_listening "$port"; then
    warn "$label port $port is already in use (run_local.sh will try to free it, or stop the other process)"
  fi
done

if port_listening 3000 && [[ "$WEB" != 3000 ]]; then
  warn "Port 3000 is in use — likely Nestiq or legacy docker-compose; Neuro Flow uses $WEB"
fi
if port_listening 8000 && [[ "$API" != 8000 ]]; then
  warn "Port 8000 is in use — likely Nestiq or legacy docker-compose; Neuro Flow uses $API"
fi

if docker compose -f "$ROOT/docker-compose.prod.yml" ps -q 2>/dev/null | grep -q .; then
  if port_listening "$WEB" || port_listening "$API"; then
    warn "docker-compose.prod.yml may be running — it also binds host ports $WEB and $API"
  fi
fi

printf '\033[36m[ports]\033[0m Neuro Flow: web=%s api=%s | Nestiq (proxy): web=%s api=%s\n' "$WEB" "$API" "$NEST_WEB" "$NEST_API"

if [[ "$errors" -gt 0 ]]; then
  exit 1
fi
