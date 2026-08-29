param(
  [ValidateSet('C3', 'S3')]
  [string]$Board = 'C3',
  [string]$Port,
  [switch]$CompileOnly,
  [string]$ArduinoCli = 'arduino-cli',
  [string]$ConfigFile
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sketch = Join-Path $root 'firmware\trace_squeeze_wifi'

$cliCommand = Get-Command $ArduinoCli -ErrorAction SilentlyContinue
if (-not $cliCommand) {
  throw "Arduino CLI was not found. Install it from https://arduino.github.io/arduino-cli/ and ensure 'arduino-cli' is on PATH, or pass -ArduinoCli."
}
$cli = $cliCommand.Source

if ($Board -eq 'C3') {
  $fqbn = 'esp32:esp32:nologo_esp32c3_super_mini'
  $buildName = 'trace_squeeze_wifi_multi_c3'
} else {
  $fqbn = 'esp32:esp32:esp32s3:USBMode=hwcdc,CDCOnBoot=default'
  $buildName = 'trace_squeeze_wifi_multi_s3'
}
$buildPath = Join-Path ([IO.Path]::GetTempPath()) $buildName

if (-not $CompileOnly -and -not $Port) {
  $ports = @([IO.Ports.SerialPort]::GetPortNames() | Sort-Object)
  if ($ports.Count -ne 1) {
    $shown = if ($ports.Count) { $ports -join ', ' } else { 'none' }
    throw "Connect exactly one Pebble or pass -Port COMx. Detected ports: $shown"
  }
  $Port = $ports[0]
}

$arguments = @(
  'compile',
  '--fqbn', $fqbn,
  '--build-path', $buildPath
)
if ($ConfigFile) {
  $arguments += @('--config-file', (Resolve-Path -LiteralPath $ConfigFile).Path)
}
if (-not $CompileOnly) {
  $arguments += @('--upload', '--port', $Port)
}
$arguments += $sketch

& $cli @arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

[pscustomobject]@{
  board = $Board
  port = if ($CompileOnly) { '-' } else { $Port }
  action = if ($CompileOnly) { 'compiled' } else { 'compiled-and-flashed' }
  build = $buildPath
} | ConvertTo-Json -Compress
