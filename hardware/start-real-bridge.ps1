$ErrorActionPreference = 'Stop'

$bridgeRoot = Join-Path $PSScriptRoot 'bridge'
$env:npm_config_cache = Join-Path $PSScriptRoot '.npm-cache'
$env:npm_config_update_notifier = 'false'
if (-not $env:TRACE_SERIAL_PORT) {
    $ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object)
    if ($ports.Count -ne 1) {
        throw "Set TRACE_SERIAL_PORT explicitly; detected ports: $($ports -join ', ')"
    }
    $env:TRACE_SERIAL_PORT = $ports[0]
}
$env:TRACE_HTTP_PORT = if ($env:TRACE_HTTP_PORT) { $env:TRACE_HTTP_PORT } else { '8798' }
$env:TRACE_WS_PORT = if ($env:TRACE_WS_PORT) { $env:TRACE_WS_PORT } else { '8797' }
Remove-Item Env:TRACE_MOCK -ErrorAction SilentlyContinue

Write-Host "TRACE serial: $env:TRACE_SERIAL_PORT"
Write-Host "Test page:   http://127.0.0.1:$env:TRACE_HTTP_PORT"
Write-Host "WebSocket:   ws://127.0.0.1:$env:TRACE_WS_PORT"

Push-Location $bridgeRoot
try {
    & npm start
}
finally {
    Pop-Location
}
