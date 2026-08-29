param(
  [int]$Port = 8789,
  [int]$WaitSeconds = 12,
  [string]$HotspotSsid = $(if ($env:TRACE_HOTSPOT_SSID) { $env:TRACE_HOTSPOT_SSID } else { 'TRACE-Bridge' }),
  [string]$HotspotPassphrase = $env:TRACE_HOTSPOT_PASSPHRASE,
  [switch]$SkipHotspot
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$integration = Join-Path $root 'software-integration'
$hotspotScript = Join-Path $PSScriptRoot 'trace-bridge-hotspot.ps1'
$serverScript = Join-Path $PSScriptRoot 'trace-demo-server.mjs'
$simulatorScript = Join-Path $PSScriptRoot 'trace-virtual-devices.mjs'
$gatewayScript = Join-Path $PSScriptRoot 'trace-software-gateway.mjs'
$runtimeRoot = Join-Path $root '.runtime'
$configFile = Join-Path $runtimeRoot 'trace-device-config.js'
$windowsPowerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

if (-not $SkipHotspot) {
  if (-not $HotspotPassphrase) {
    $securePassphrase = Read-Host 'TRACE hotspot passphrase (8-63 characters)' -AsSecureString
    $credential = [pscredential]::new('TRACE', $securePassphrase)
    $HotspotPassphrase = $credential.GetNetworkCredential().Password
  }
  $previousSsid = $env:TRACE_HOTSPOT_SSID
  $previousPassphrase = $env:TRACE_HOTSPOT_PASSPHRASE
  try {
    $env:TRACE_HOTSPOT_SSID = $HotspotSsid
    $env:TRACE_HOTSPOT_PASSPHRASE = $HotspotPassphrase
    & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $hotspotScript -Action Start | Out-Host
  } catch {
    Write-Warning "TRACE-Bridge hotspot could not be started automatically: $($_.Exception.Message)"
  } finally {
    $env:TRACE_HOTSPOT_SSID = $previousSsid
    $env:TRACE_HOTSPOT_PASSPHRASE = $previousPassphrase
    $HotspotPassphrase = $null
    $credential = $null
    $securePassphrase = $null
  }
}

function Find-TraceDevices {
  # Mobile Hotspot clients are already present in the Windows neighbour table.
  # Probe only live entries so this also works in Windows PowerShell 5.1, where
  # ForEach-Object -Parallel is unavailable.
  $candidateAddresses = @(
    Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -like '192.168.137.*' -and
        $_.IPAddress -notin @('192.168.137.1', '192.168.137.255') -and
        $_.LinkLayerAddress -notin @('', '00-00-00-00-00-00', 'FF-FF-FF-FF-FF-FF') -and
        $_.State -ne 'Unreachable'
      } |
      Select-Object -ExpandProperty IPAddress -Unique
  )

  $results = foreach ($address in $candidateAddresses) {
    try {
      $status = Invoke-RestMethod -Uri "http://$address/status" -TimeoutSec 1
      if ($status.ws_port -eq 8797 -and $status.ap_ssid -like 'TRACE-Pebble*') {
        [pscustomobject]@{ address = $address; status = $status }
      }
    } catch {}
  }
  return @($results | Sort-Object address -Unique | Select-Object -First 3)
}

$realDevices = @()
$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ($realDevices.Count -eq 0 -and (Get-Date) -lt $deadline) {
  $realDevices = @(Find-TraceDevices)
  if ($realDevices.Count -eq 0) { Start-Sleep -Milliseconds 700 }
}

$simulatorPorts = 8800, 8801, 8802
foreach ($simulatorPort in $simulatorPorts) {
  $listener = Get-NetTCPConnection -State Listen -LocalPort $simulatorPort -ErrorAction SilentlyContinue
  if (-not $listener) {
    Start-Process -FilePath 'node.exe' -ArgumentList @($simulatorScript, $simulatorPort) -WindowStyle Hidden
  }
}

$deviceConfigs = [System.Collections.Generic.List[object]]::new()
$slot = 1
foreach ($device in $realDevices) {
  $status = $device.status
  $id = if ($status.device_id) { [string]$status.device_id } else { "trace-hardware-{0:D2}" -f $slot }
  $label = if ($status.device_label) { [string]$status.device_label } else { "Pebble {0:D2}" -f $slot }
  $deviceConfigs.Add([ordered]@{
    id = $id
    label = $label
    endpoint = "ws://$($device.address):8797/trace"
    kind = 'hardware'
  })
  $slot += 1
}

while ($deviceConfigs.Count -lt 3) {
  $simulatorPort = 8799 + $slot
  $deviceConfigs.Add([ordered]@{
    id = "trace-sim-{0:D2}" -f $slot
    label = "Pebble {0:D2}" -f $slot
    endpoint = "ws://127.0.0.1:$simulatorPort/trace"
    kind = 'simulator'
  })
  $slot += 1
}

$configJson = @($deviceConfigs) | ConvertTo-Json -Compress
$legacyEndpoint = $deviceConfigs[0].endpoint
$configSource = "window.TRACE_PEBBLE_DEVICES = $configJson;`nwindow.TRACE_PEBBLE_ENDPOINT = `"$legacyEndpoint`";`n"
[IO.File]::WriteAllText($configFile, $configSource, [Text.UTF8Encoding]::new($false))

$gatewayHealthy = $false
try {
  $gatewayHealthy = (Invoke-RestMethod -Uri 'http://127.0.0.1:8796/health' -TimeoutSec 1).ok
} catch {}
if (-not $gatewayHealthy) {
  $gatewayListener = Get-NetTCPConnection -State Listen -LocalPort 8797 -ErrorAction SilentlyContinue
  if ($gatewayListener) {
    throw 'Port 8797 is occupied by another process; TRACE software gateway was not started.'
  }
  Start-Process -FilePath 'node.exe' -ArgumentList @($gatewayScript, 8797, 8796, $configFile) -WindowStyle Hidden
}

$existing = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $existing) {
  Start-Process -FilePath 'node.exe' -ArgumentList @($serverScript, $integration, $Port, $configFile) -WindowStyle Hidden
}
Start-Sleep -Milliseconds 800

[pscustomobject]@{
  realDeviceCount = $realDevices.Count
  devices = @($deviceConfigs)
  localDemo = "http://127.0.0.1:$Port"
  phoneDemo = "http://192.168.137.1:$Port"
  softwareWebSocket = 'ws://127.0.0.1:8797/trace'
  softwareStatus = 'http://127.0.0.1:8796/status'
} | ConvertTo-Json -Depth 4 -Compress
