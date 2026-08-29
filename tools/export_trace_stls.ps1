param(
    [ValidateSet('back','front','sensor','board')][string[]]$Parts = @('back','front','sensor','board')
)

$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$exportRoot = Join-Path $workspaceRoot 'exports'
$runner = Join-Path $PSScriptRoot 'run_one_trace_export.ps1'
New-Item -ItemType Directory -Force -Path $exportRoot | Out-Null

$jobs = @()
foreach ($variantName in @('bag_esp32', 'badge_mini', 'clip_mini')) {
    foreach ($partName in $Parts) {
        $output = Join-Path $exportRoot "TRACE_${variantName}_${partName}.stl"
        $job = Start-Job -ScriptBlock {
            param($scriptPath, $variantArg, $partArg)
            & $scriptPath -VariantName $variantArg -PartName $partArg
        } -ArgumentList $runner, $variantName, $partName
        $jobs += [pscustomobject]@{ Variant=$variantName; Part=$partName; Output=$output; Job=$job }
    }
}

$jobs.Job | Wait-Job | Out-Null
$failed = @()
foreach ($job in $jobs) {
    $messages = Receive-Job -Job $job.Job
    $messages | ForEach-Object { $_ }
    $item = Get-Item -LiteralPath $job.Output -ErrorAction SilentlyContinue
    if ($job.Job.State -ne 'Completed' -or $null -eq $item -or $item.Length -eq 0) {
        $failed += "$($job.Variant)/$($job.Part) state=$($job.Job.State)"
    }
    else {
        "OK $($job.Variant)/$($job.Part) $($item.Length) bytes"
    }
    Remove-Job -Job $job.Job -Force
}

if ($failed.Count -gt 0) {
    throw "STL export failures: $($failed -join '; ')"
}
