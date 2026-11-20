# Big-deal radar – napi feladatok telepítése a Windows Task Schedulerbe.
#
# Használat (normál PowerShell, nem kell rendszergazda):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-task.ps1
#
# Három időpont: 08:00, 12:00, 20:00.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dailyScript = Join-Path $PSScriptRoot "daily.ps1"
$powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$times = @("08:00", "12:00", "20:00")

if (-not (Test-Path $dailyScript)) {
    throw "Nem találom a daily.ps1 fájlt: $dailyScript"
}

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

foreach ($time in $times) {
    $action = New-ScheduledTaskAction `
        -Execute $powershell `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$dailyScript`""

    $trigger = New-ScheduledTaskTrigger -Daily -At $time
    $taskName = "BigDealRadar-" + $time.Replace(":", "")

    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "Big-deal radar napi frissítés ($time)" `
        -Force | Out-Null

    Write-Host "✅ $taskName létrehozva – minden nap $time"
}

Write-Host ""
Write-Host "Ellenőrzés: Get-ScheduledTask -TaskName 'BigDealRadar-*'"
Write-Host "Törlés:    powershell -File scripts/remove-task.ps1"
