param(
  [ValidateSet('Simulator', 'Hardware')]
  [string]$Mode = 'Simulator'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$hardwareStart = Join-Path $repoRoot 'hardware\tools\start-trace-demo.ps1'
$softwareRoot = Join-Path $repoRoot 'software'

if ($Mode -eq 'Hardware') {
  & $hardwareStart
} else {
  & $hardwareStart -WaitSeconds 0 -SkipHotspot
}

$softwareListener = Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $softwareListener) {
  Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev:lan') -WorkingDirectory $softwareRoot -WindowStyle Hidden
}

Start-Sleep -Seconds 2
$stageUrl = 'http://127.0.0.1:8789/software-stage.html?app=http%3A%2F%2F127.0.0.1%3A3000%2F&gateway=ws%3A%2F%2F127.0.0.1%3A8797%2Ftrace'
Start-Process $stageUrl

[pscustomobject]@{
  mode = $Mode
  software = 'http://127.0.0.1:3000/'
  stage = $stageUrl
  gateway = 'ws://127.0.0.1:8797/trace'
  status = 'http://127.0.0.1:8796/status'
} | ConvertTo-Json -Compress
