# Kairo Manhwa - Deploy changes to Docker containers
# Run this when Docker Desktop is working

$COMPOSE_FILE = "docker-compose.yml"
$PROJECT_DIR = $PSScriptRoot

Write-Host "=== Deploying Kairo changes ===" -ForegroundColor Cyan

# Step 1: Rebuild images with new code
Write-Host "[1/3] Rebuilding Docker images..." -ForegroundColor Yellow
Set-Location -LiteralPath $PROJECT_DIR
docker compose build --no-cache web celery-worker celery-beat translation-server

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Restart containers
Write-Host "[2/3] Restarting containers..." -ForegroundColor Yellow
docker compose up -d

# Step 3: Verify
Write-Host "[3/3] Verifying deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
$webStatus = docker exec kairo-web curl.exe -s -o /dev/null -w "%{http_code}" http://localhost:8000/ 2>$null
$translationStatus = docker exec kairo-translation curl.exe -s -o /dev/null -w "%{http_code}" http://localhost:8001/ 2>$null

Write-Host ""
if ($webStatus -eq "200") {
    Write-Host "  Web App: OK (port 8000)" -ForegroundColor Green
} else {
    Write-Host "  Web App: ERROR (status: $webStatus)" -ForegroundColor Red
}

if ($translationStatus -eq "200") {
    Write-Host "  Translation Server: OK (port 8001)" -ForegroundColor Green
} else {
    Write-Host "  Translation Server: ERROR (status: $translationStatus)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Cyan
