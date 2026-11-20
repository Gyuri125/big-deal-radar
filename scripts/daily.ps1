# Big-deal radar – napi futás (Windows Task Schedulerhez)
#
# Használat:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/daily.ps1
#
# Ez a szkript a projekt gyökerében fut, naplót ír a logs/ mappába,
# lefuttatja a pipeline-t, buildel, majd commitol és pushol, ha változott adat.

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("daily-" + (Get-Date -Format "yyyy-MM-dd") + ".log")

function Write-Log {
    param([string]$Message)
    $line = "[$(Get-Date -Format o)] $Message"
    Write-Host $line
    Add-Content -Path $logFile -Value $line -Encoding utf8
}

Write-Log "=== Big-deal radar napi futás ==="
Write-Log "Mappa: $root"

try {
    npm run daily -- --commit 2>&1 | Tee-Object -FilePath $logFile -Append

    if ($LASTEXITCODE -ne 0) {
        throw "A pipeline hibával lépett ki: $LASTEXITCODE"
    }

    Write-Log "=== Napi futás sikeres ==="
}
catch {
    Write-Log "=== HIBA: $_ ==="
    exit 1
}
