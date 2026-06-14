# HyperMart end-to-end automation runner.
# Boots Backend_php (PHP) + the Vite frontend, seeds MySQL, runs the Playwright
# suite headless, then tears the servers down.
#
# Prereqts on the host:
#   - PHP 8+ on PATH (or set $env:PHP_BIN) with pdo_mysql, curl, mbstring, openssl
#   - A reachable MySQL/MariaDB; set DB_* below or in Backend_php/.env
#   - Node 18+ (npm/npx)
#
# Usage:  pwsh -File e2e/run-e2e.ps1   (run from the repo root)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$php  = if ($env:PHP_BIN) { $env:PHP_BIN } else { 'php' }
$apiPort = 8000; $webPort = 5173

Write-Host '== Seeding database (Backend_php/seed.php) ==' -ForegroundColor Cyan
& $php "$root\Backend_php\seed.php"

Write-Host '== Starting Backend_php on ' $apiPort ' ==' -ForegroundColor Cyan
$api = Start-Process -FilePath $php -ArgumentList "-S","127.0.0.1:$apiPort","index.php" `
  -WorkingDirectory "$root\Backend_php" -PassThru -WindowStyle Hidden

Write-Host '== Starting frontend (vite) on ' $webPort ' ==' -ForegroundColor Cyan
$env:VITE_API_URL = "http://127.0.0.1:$apiPort"
$web = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c',"npm run dev -- --host 127.0.0.1 --port $webPort --strictPort" `
  -WorkingDirectory "$root\frontend" -PassThru -WindowStyle Hidden

try {
  Write-Host '== Waiting for servers ==' -ForegroundColor Cyan
  foreach ($u in @("http://127.0.0.1:$apiPort/shops","http://127.0.0.1:$webPort/")) {
    for ($i=0; $i -lt 40; $i++) {
      try { Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 3 | Out-Null; break } catch { Start-Sleep 1 }
    }
  }
  Write-Host '== Running Playwright e2e ==' -ForegroundColor Cyan
  Push-Location $PSScriptRoot
  if (-not (Test-Path node_modules)) { & npm.cmd install --no-audit --no-fund }
  & npx.cmd playwright install chromium | Out-Null
  & npx.cmd playwright test
  $code = $LASTEXITCODE
  Pop-Location
} finally {
  Write-Host '== Stopping servers ==' -ForegroundColor Cyan
  foreach ($p in @($api,$web)) { if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } }
}
exit $code
