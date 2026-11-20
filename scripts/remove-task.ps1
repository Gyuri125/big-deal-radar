# Big-deal radar – napi feladatok eltávolítása a Windows Task Schedulerből.

$ErrorActionPreference = "Stop"

$times = @("0800", "1200", "2000")

foreach ($time in $times) {
    $taskName = "BigDealRadar-$time"
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
        Write-Host "🗑️  $taskName törölve"
    }
    catch {
        Write-Host "⚠️  $taskName nem található (talán már törölve van)"
    }
}
