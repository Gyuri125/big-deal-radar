# Big-deal radar – napi futás (Windows Task Schedulerhez)
#
# Használat:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/daily.ps1
#
# Ez a szkript a projekt gyökerében fut, naplót ír a logs/ mappába,
# lefuttatja a pipeline-t, buildel, majd commitol és pushol, ha változott adat.

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:TZ = "Europe/Budapest"

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

# A Task Scheduler néha szűkebb PATH-tal indul, ezért megkeressük az npm-et.
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
}
if (-not $npmCommand) {
    Write-Log "=== HIBA: nem találom az npm parancsot. Telepítsd a Node.js-t, vagy indítsd kézzel. ==="
    exit 1
}

Write-Log "npm: $($npmCommand.Source)"

try {
    # cmd /c-n keresztül futtatjuk, így a natív stderr nem vált ki PowerShell NativeCommandError-t.
    $ErrorActionPreference = "Continue"
    $importLine = "`"$($npmCommand.Source)`" run import 2>&1"
    cmd /c $importLine | Tee-Object -FilePath $logFile -Append
    $importExitCode = $LASTEXITCODE
    if ($importExitCode -ne 0) {
        throw "Az import hibával lépett ki: $importExitCode"
    }

    # A Discord-digest elsődleges küldője a GitHub Actions; a laptop csak adatot generál és commitol.
    $commandLine = "`"$($npmCommand.Source)`" run daily -- --commit --no-notify 2>&1"
    cmd /c $commandLine | Tee-Object -FilePath $logFile -Append
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"

    if ($exitCode -ne 0) {
        throw "A pipeline hibával lépett ki: $exitCode"
    }

    Write-Log "=== Napi futás sikeres ==="
}
catch {
    Write-Log "=== HIBA: $_ ==="
    exit 1
}
