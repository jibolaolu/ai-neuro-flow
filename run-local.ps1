param(
    [switch]$SkipInstall,
    [switch]$IncludeWorkers,
    [switch]$OpenBrowser,
    [switch]$Tunnel,
    [int]$BackendPort = 8004,
    [int]$FrontendPort = 3004
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$portsFile = Join-Path $root "ports.env"
if (Test-Path $portsFile) {
    Get-Content $portsFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)\s*$' -and $_ -notmatch '^\s*#') {
            $val = $Matches[2].Trim().Trim('"').Trim("'")
            Set-Item -Path "env:$($Matches[1])" -Value $val
        }
    }
}
if ($env:NEUROFLOW_API_PORT) { $BackendPort = [int]$env:NEUROFLOW_API_PORT }
if ($env:NEUROFLOW_WEB_PORT) { $FrontendPort = [int]$env:NEUROFLOW_WEB_PORT }
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$workersDir = Join-Path $root "ai-workers"

$backendVenv = Join-Path $backendDir ".venv"
$workersVenv = Join-Path $workersDir ".venv"

$backendPython = Join-Path $backendVenv "Scripts\python.exe"
$workersPython = Join-Path $workersVenv "Scripts\python.exe"

$backendEnvFile = Join-Path $backendDir ".env"
$frontendEnvFile = Join-Path $frontendDir ".env.local"
$workersEnvFile = Join-Path $workersDir ".env"

function Get-Ts {
    return (Get-Date -Format "d/MM/yyyy, h:mm:ss tt")
}

# NestJS-style structured log line
function Write-NestLog {
    param(
        [string]$Message,
        [string]$Level = "LOG",        # LOG | WARN | ERROR
        [string]$Context = "Bootstrap"
    )
    $ts      = Get-Ts
    $pid_str = $PID
    switch ($Level) {
        "WARN"  { $levelColor = "Yellow";  $label = "   WARN" }
        "ERROR" { $levelColor = "Red";     $label = "  ERROR" }
        default { $levelColor = "Green";   $label = "    LOG" }
    }
    Write-Host "[NeuroFlow]" -ForegroundColor Green -NoNewline
    Write-Host "  $pid_str  " -ForegroundColor DarkGreen -NoNewline
    Write-Host "-  $ts  " -ForegroundColor DarkGray -NoNewline
    Write-Host $label -ForegroundColor $levelColor -NoNewline
    Write-Host "  [$Context]" -ForegroundColor Yellow -NoNewline
    Write-Host " $Message"
}

function Write-Step {
    param([string]$Message)
    Write-NestLog -Message $Message -Level "LOG" -Context "Bootstrap"
}

function Write-Ok {
    param([string]$Message)
    Write-NestLog -Message $Message -Level "LOG" -Context "Bootstrap"
}

function Write-Warn {
    param([string]$Message)
    Write-NestLog -Message $Message -Level "WARN" -Context "Bootstrap"
}

function Fail {
    param([string]$Message)
    Write-NestLog -Message $Message -Level "ERROR" -Context "Bootstrap"
    throw $Message
}

function Write-Banner {
    Write-Host ""
    Write-Host "  ███╗   ██╗███████╗██╗   ██╗██████╗  ██████╗ " -ForegroundColor Green
    Write-Host "  ████╗  ██║██╔════╝██║   ██║██╔══██╗██╔═══██╗" -ForegroundColor Green
    Write-Host "  ██╔██╗ ██║█████╗  ██║   ██║██████╔╝██║   ██║" -ForegroundColor Green
    Write-Host "  ██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██║   ██║" -ForegroundColor Green
    Write-Host "  ██║ ╚████║███████╗╚██████╔╝██║  ██║╚██████╔╝" -ForegroundColor Green
    Write-Host "  ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ " -ForegroundColor Green
    Write-Host ""
    Write-Host "  Clinical Platform  ·  Local Development" -ForegroundColor DarkGray
    Write-Host ""
}

function Assert-Directory {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        Fail "Required directory not found: $Path"
    }
}

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Fail "Required command not found in PATH: $Name"
    }
}

function Ensure-EnvFile {
    param(
        [string]$Path,
        [string]$Content,
        [string]$Label
    )

    if (-not (Test-Path $Path)) {
        Set-Content -Path $Path -Value $Content -Encoding ASCII
        Write-Ok "Created default $Label file: $Path"
    }
    else {
        Write-Step "$Label file already exists: $Path"
    }
}

function New-RandomSecret {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return ([System.BitConverter]::ToString($bytes) -replace '-','').ToLower()
}

# Appends KEY=value to an env file only when the key is absent.
# Pass Value "__generate__" to auto-create a random 32-byte hex secret.
function Ensure-EnvVar {
    param(
        [string]$File,
        [string]$Key,
        [string]$Value = ""
    )

    $existing = Get-Content $File -ErrorAction SilentlyContinue
    if ($existing -match "^${Key}=") { return }

    if ($Value -eq "__generate__") {
        $Value = New-RandomSecret
        Write-Ok "Generated $Key"
    }

    Add-Content -Path $File -Value "${Key}=${Value}" -Encoding ASCII
}

function Invoke-DatabaseSeed {
    Write-Step "Seeding test users"
    Push-Location $backendDir
    try {
        & $backendPython -m app.seed
    } finally {
        Pop-Location
    }
}

function Start-CloudflareTunnel {
    $cf = Get-Command "cloudflared" -ErrorAction SilentlyContinue
    if (-not $cf) {
        Write-Warn "cloudflared not found — tunnel skipped."
        Write-Warn "  Install: winget install Cloudflare.cloudflared"
        return
    }

    Write-Step "Starting Cloudflare tunnel on port $BackendPort ..."
    $tunnelJob = Start-Job -ScriptBlock {
        param($port)
        cloudflared tunnel --url "http://localhost:$port" 2>&1
    } -ArgumentList $BackendPort

    Start-Sleep -Seconds 10

    $output = Receive-Job $tunnelJob
    $urlLine = $output | Where-Object { $_ -match "https://[a-z0-9\-]+\.trycloudflare\.com" }
    if ($urlLine -match "(https://[a-z0-9\-]+\.trycloudflare\.com)") {
        $tunnelUrl = $Matches[1]
        Write-Host ""
        Write-Host "┌─────────────────────────────────────────────────────────────┐" -ForegroundColor Green
        Write-Host "│  Cloudflare tunnel active                                   │" -ForegroundColor Green
        Write-Host "│  Public URL:  $tunnelUrl" -ForegroundColor Green
        Write-Host "│                                                             │" -ForegroundColor Green
        Write-Host "│  Set PLATFORM_BASE_URL to the URL above in backend/.env     │" -ForegroundColor Green
        Write-Host "└─────────────────────────────────────────────────────────────┘" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Warn "Tunnel started — check above output for the public URL."
        Write-Host ($output -join "`n")
    }
}

function Ensure-Venv {
    param(
        [string]$VenvPath,
        [string]$PythonExe,
        [string]$Label
    )

    if (-not (Test-Path $PythonExe)) {
        Write-Step "Creating $Label virtual environment"
        python -m venv $VenvPath
    }
    else {
        Write-Step "$Label virtual environment already exists"
    }
}

function Install-BackendDependencies {
    Write-Step "Installing backend dependencies"
    & $backendPython -m pip install -r (Join-Path $backendDir "requirements.txt")
}

function Install-WorkerDependencies {
    Write-Step "Installing AI worker dependencies"
    & $workersPython -m pip install -r (Join-Path $workersDir "requirements.txt")
}

function Install-FrontendDependencies {
    Write-Step "Installing frontend dependencies"
    npm install --prefix $frontendDir
}

function Ensure-PortFree {
    param(
        [int]$Port,
        [string]$Label
    )

    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if (-not $connections) {
        return
    }

    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
        if ($processId -and $processId -ne 0) {
            Write-Warn "$Label port $Port is in use by PID $processId. Stopping it now."
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }

    Start-Sleep -Seconds 1
}

function Wait-ForHttp {
    param(
        [string]$Url,
        [string]$Label,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Ok "$Label responded at $Url"
                return
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }

    Fail "$Label did not become ready at $Url within $TimeoutSeconds seconds"
}

Assert-Directory $backendDir
Assert-Directory $frontendDir
Assert-Directory $workersDir

Assert-Command "python"
Assert-Command "npm"

if ($BackendPort -eq $FrontendPort) {
    Fail "BackendPort and FrontendPort must be different."
}

Write-Banner
Write-Step "Preparing NeuroFlow local environment"

Ensure-EnvFile -Path $backendEnvFile -Label "backend" -Content @"
DATABASE_URL=sqlite:///./neuro_flow.db
ENVIRONMENT=development
LOG_LEVEL=INFO
PLATFORM_DISPLAY_NAME=Neuro Flow
PLATFORM_BASE_URL=http://localhost:$FrontendPort
FRONTEND_URL=http://localhost:$FrontendPort
SUPPORT_EMAIL=support@neuroflow.app
ENABLE_LEGACY_WOOCOMMERCE_WEBHOOK=false
SIGNUP_TRIAL_DAYS=14
"@

# Auto-generate secrets if missing
Ensure-EnvVar -File $backendEnvFile -Key "JWT_SECRET"     -Value "__generate__"
Ensure-EnvVar -File $backendEnvFile -Key "WEBHOOK_SECRET" -Value "__generate__"

# Auth0 placeholders — fill once you create an Auth0 tenant
Ensure-EnvVar -File $backendEnvFile -Key "AUTH0_DOMAIN"   -Value ""
Ensure-EnvVar -File $backendEnvFile -Key "AUTH0_AUDIENCE" -Value ""

Ensure-EnvFile -Path $frontendEnvFile -Label "frontend" -Content @"
NEXT_PUBLIC_API_URL=
BACKEND_URL=http://localhost:$BackendPort
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:$FrontendPort
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=
"@

Ensure-EnvFile -Path $workersEnvFile -Label "AI worker" -Content @"
API_BASE_URL=http://localhost:$BackendPort
"@

Ensure-Venv -VenvPath $backendVenv -PythonExe $backendPython -Label "backend"

if ($IncludeWorkers) {
    Ensure-Venv -VenvPath $workersVenv -PythonExe $workersPython -Label "AI worker"
}

if (-not $SkipInstall) {
    Install-BackendDependencies
    Install-FrontendDependencies

    if ($IncludeWorkers) {
        Install-WorkerDependencies
    }
}
else {
    Write-Step "Skipping dependency installation because -SkipInstall was provided"
}

Invoke-DatabaseSeed

if ($BackendPort -eq $FrontendPort) {
    throw "Backend and frontend cannot share port $BackendPort"
}

Ensure-PortFree -Port $BackendPort -Label "Backend"
Ensure-PortFree -Port $FrontendPort -Label "Frontend"

$checkPorts = Join-Path $root "scripts\check-ports.sh"
if (Test-Path $checkPorts) {
    bash $checkPorts 2>$null
}

$backendCommand = "Set-Location '$backendDir'; . '$($backendVenv)\Scripts\Activate.ps1'; uvicorn app.main:app --host 0.0.0.0 --port $BackendPort"
$frontendCommand = "Set-Location '$frontendDir'; npx next dev --hostname 0.0.0.0 --port $FrontendPort"

Write-Step "Starting backend terminal"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $backendCommand
) | Out-Null

Start-Sleep -Seconds 3

Write-Step "Starting frontend terminal"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $frontendCommand
) | Out-Null

Wait-ForHttp -Url "http://localhost:$BackendPort/health" -Label "Backend health check"
Wait-ForHttp -Url "http://localhost:$FrontendPort" -Label "Frontend app"

if ($Tunnel) {
    Start-CloudflareTunnel
}

if ($IncludeWorkers) {
    Write-Step "AI workers were prepared locally. To run one manually, use:"
    Write-Host "  .\ai-workers\.venv\Scripts\python.exe .\workers\report_generator.py" -ForegroundColor Gray
}

Write-Ok "All services started"
Write-Host ""
Write-Host "  ┌──────────────────────────────────────────────────────────────┐" -ForegroundColor Green
Write-Host "  │                   NeuroFlow  —  Running                      │" -ForegroundColor Green
Write-Host "  ├──────────────────────────────────────────────────────────────┤" -ForegroundColor Green
Write-Host "  │  " -NoNewline -ForegroundColor Green
Write-Host "Frontend         " -NoNewline -ForegroundColor DarkGray
Write-Host "  http://localhost:$FrontendPort              " -NoNewline -ForegroundColor Cyan
Write-Host "  │" -ForegroundColor Green
Write-Host "  │  " -NoNewline -ForegroundColor Green
Write-Host "API docs         " -NoNewline -ForegroundColor DarkGray
Write-Host "  http://localhost:$BackendPort/docs          " -NoNewline -ForegroundColor Cyan
Write-Host "  │" -ForegroundColor Green
Write-Host "  │  " -NoNewline -ForegroundColor Green
Write-Host "Health check     " -NoNewline -ForegroundColor DarkGray
Write-Host "  http://localhost:$BackendPort/health        " -NoNewline -ForegroundColor Cyan
Write-Host "  │" -ForegroundColor Green
Write-Host "  │  " -NoNewline -ForegroundColor Green
Write-Host "Auth (mock)      " -NoNewline -ForegroundColor DarkGray
Write-Host "  http://localhost:${FrontendPort}/auth/mock  " -NoNewline -ForegroundColor Cyan
Write-Host "  │" -ForegroundColor Green
Write-Host "  ├──────────────────────────────────────────────────────────────┤" -ForegroundColor Green
Write-Host "  │  Quick rerun:   .\run-local.ps1 -SkipInstall                 │" -ForegroundColor DarkGray
Write-Host "  │  With tunnel:   .\run-local.ps1 -SkipInstall -Tunnel         │" -ForegroundColor DarkGray
Write-Host "  │  Stop:          Close this window / Ctrl+C                   │" -ForegroundColor DarkGray
Write-Host "  └──────────────────────────────────────────────────────────────┘" -ForegroundColor Green
Write-Host ""

if ($OpenBrowser) {
    Start-Process "http://localhost:$FrontendPort"
}
