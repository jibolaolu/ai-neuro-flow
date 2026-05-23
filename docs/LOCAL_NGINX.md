# Local development with nginx (Documents/localproxy)

Neuro Flow runs on **plain HTTP ports** on Windows/WSL. Your **nginx** proxy in `Documents/localproxy` terminates HTTPS and maps hostnames to those ports.

## Ports (see `ports.env`)

| App | Upstream (run_local) | nginx hostname (HTTPS :8443) |
|-----|----------------------|------------------------------|
| Web | `127.0.0.1:3004` | `https://neuroflow.localtest.me:8443` |
| API | `127.0.0.1:8004` | `https://neuroflow-api.localtest.me:8443` |

### ERR_CONNECTION_RESET on :8443

1. **Start Neuro Flow** — `bash ./run_local.sh` (must listen on **3004**).
2. **Regenerate nginx** (WSL):
   ```bash
   cd ~/Documents/localproxy
   bash setup_local_https_proxy.sh --force
   ```
3. Confirm nginx is listening: `ss -ltn | grep 8443`
4. Try **http://localhost:3004** first — if that works, the app is fine; only proxy/nginx needs fixing.

## Workflow

1. Start Neuro Flow:
   ```bash
   bash ./run_local.sh
   ```
2. Regenerate / reload nginx (WSL, from `Documents/localproxy`):
   ```bash
   bash setup_local_https_proxy.sh --force
   ```
   Or use `refresh-proxy.sh` after a WSL restart (updates Windows host IP for fallback upstreams).

3. Open in browser: **https://neuroflow.localtest.me:8443**

## Environment

**backend/.env** (browser-facing URLs — must match nginx):

```env
FRONTEND_URL=https://neuroflow.localtest.me:8443
PLATFORM_BASE_URL=https://neuroflow.localtest.me:8443
EXTRA_CORS_ORIGINS=https://neuroflow.localtest.me:8443,https://neuroflow-api.localtest.me:8443
```

**frontend/.env.local** (server-side proxy to API — stays on localhost):

```env
BACKEND_URL=http://127.0.0.1:8004
# Optional: browser calls API directly over HTTPS (avoids mixed content)
# NEXT_PUBLIC_API_URL=https://neuroflow-api.localtest.me:8443
AUTH0_BASE_URL=https://neuroflow.localtest.me:8443
```

## Auth0

Add to Auth0 application **Allowed Callback URLs**:

- `https://neuroflow.localtest.me:8443/api/auth/callback`

## Do not use

- `setup_local_https.sh` (Caddy) — this repo uses **nginx** via `setup_local_https_proxy.sh` only.

## Port clashes

Neuro Flow uses **3004** and **8004**. Other apps in `setup_local_https_proxy.sh` use different ports. Check with:

```bash
bash scripts/check-ports.sh
```
