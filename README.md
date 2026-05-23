# Neuro Flow Platform

This repository contains the local Neuro Flow prototype for referral intake, clinician coordination, booking, assessment delivery, reporting, billing, and service-plan monitoring.

## Services

- `frontend` - Next.js UI on port `3004`
- `backend` - FastAPI API on port `8004`
- Canonical ports live in `ports.env`; HTTPS via **nginx** in `Documents/localproxy` — see [docs/LOCAL_NGINX.md](docs/LOCAL_NGINX.md)
- `ai-workers` - optional Python worker scripts

## Prerequisites

- Bash shell
- Node.js 20+
- npm 10+
- Python 3.12+
- `curl`

## Fastest Local Run

From `C:\Users\EAGLESOLUTIONS\Documents\AI_NEUROACCESS_ADHD_AUTISM\adhd-autism-platform` run:

```bash
bash ./dont-run-local.sh
```

That script will:

1. Check that `python3`, `npm`, and `curl` exist.
2. Create missing `.env` files for backend, frontend, and workers.
3. Create the backend virtual environment if needed.
4. Install backend and frontend dependencies.
5. Free ports `8004` and `3004` if they are already occupied (`bash scripts/check-ports.sh`).
6. Start the backend and frontend directly from the script.
7. Wait until both apps respond locally.
8. Optionally prepare AI worker dependencies too.

When it finishes successfully, open:

- Frontend: `http://localhost:3004`
- Backend health: `http://localhost:8004/health`

## Common Run Commands

First run:

```bash
bash ./dont-run-local.sh
```

Later runs without reinstalling packages:

```bash
bash ./dont-run-local.sh --skip-install
```

Prepare worker dependencies too:

```bash
bash ./dont-run-local.sh --include-workers
```

Start and open the browser automatically:

```bash
bash ./dont-run-local.sh --open-browser
```

Use custom local ports:

```bash
NEUROFLOW_API_PORT=8010 NEUROFLOW_WEB_PORT=3010 bash ./run_local.sh
```

## What The Script Creates

If these files do not already exist, the launcher creates them with safe local defaults.

### `backend/.env`

```env
DATABASE_URL=sqlite:///./adhd_autism.db
OPENAI_MODEL=gpt-5-mini
LOG_LEVEL=INFO
ENVIRONMENT=development
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8004
```

### `ai-workers/.env`

```env
API_BASE_URL=http://localhost:8004
```

## Manual Local Run

If you want to run each service yourself, use separate terminals.

### Backend

```powershell
cd .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8004
```

### Frontend

```powershell
cd .\frontend
npm install
npm run dev
```

### AI workers

```powershell
cd .\ai-workers
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\requirements.txt
python .\workers\report_generator.py
```

## Verification

Run the local checks from the project root:

```powershell
python .\tests\sanity_check.py --frontend-url http://localhost:3004 --backend-url http://localhost:8004
```

Optional lightweight load check:

```powershell
python .\tests\load_test.py --url http://localhost:8004/health --requests 100 --concurrency 20
```

## Notes

- The frontend defaults to the backend at `http://localhost:8004`.
- `run-local.sh` is now the primary guided local launcher.
- `run-local.ps1` still exists if you want a PowerShell-specific entry point.
- The UI currently includes the general Neuro Flow landing page, workflow demo pages, clinician portal, client portal, admin dashboard, and super-admin monitoring view.
