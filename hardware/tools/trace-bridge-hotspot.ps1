param(
  [ValidateSet('Start', 'Stop', 'Status')]
  [string]$Action = 'Status',
  [string]$Ssid = $(if ($env:TRACE_HOTSPOT_SSID) { $env:TRACE_HOTSPOT_SSID } else { 'TRACE-Bridge' }),
  [string]$Passphrase = $env:TRACE_HOTSPOT_PASSPHRASE
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]
$null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]
$null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]
$null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]

$asTaskMethods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1
}
$asTaskAction = $asTaskMethods | Where-Object { -not $_.IsGenericMethod } | Select-Object -First 1
$asTaskResult = $asTaskMethods | Where-Object { $_.IsGenericMethod } | Select-Object -First 1

function Wait-WinRtAction($Operation) {
  $task = $asTaskAction.Invoke($null, @($Operation))
  $task.GetAwaiter().GetResult()
}

function Wait-WinRtResult($Operation, [Type]$ResultType) {
  $method = $asTaskResult.MakeGenericMethod($ResultType)
  $task = $method.Invoke($null, @($Operation))
  return $task.GetAwaiter().GetResult()
}

$profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
if ($null -eq $profile) {
  throw 'No active internet connection profile.'
}

$manager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)

if ($Action -eq 'Start') {
  if (-not $Passphrase) {
    throw 'Set TRACE_HOTSPOT_PASSPHRASE or launch through start-trace-demo.ps1 for a secure prompt.'
  }
  if ($Passphrase.Length -lt 8 -or $Passphrase.Length -gt 63) {
    throw 'Hotspot passphrase must contain 8 to 63 characters.'
  }

  # Keep the bridge available while the ESP32 is rebooting or changing networks.
  [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::DisableNoConnectionsTimeout()

  $currentConfiguration = $manager.GetCurrentAccessPointConfiguration()
  $targetBand = [Windows.Networking.NetworkOperators.TetheringWiFiBand]::TwoPointFourGigahertz
  $configurationMatches = $currentConfiguration.Ssid -eq $Ssid `
    -and $currentConfiguration.Passphrase -eq $Passphrase `
    -and $currentConfiguration.Band -eq $targetBand

  if (-not $configurationMatches) {
    $configuration = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration]::new()
    $configuration.Ssid = $Ssid
    $configuration.Passphrase = $Passphrase
    $configuration.Band = $targetBand
    Wait-WinRtAction ($manager.ConfigureAccessPointAsync($configuration))
  }

  if ($manager.TetheringOperationalState.ToString() -ne 'On') {
    $result = Wait-WinRtResult ($manager.StartTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
    if ($result.Status.ToString() -ne 'Success') {
      throw "Unable to start hotspot: $($result.Status) $($result.AdditionalErrorMessage)"
    }
  }
}

if ($Action -eq 'Stop') {
  $result = Wait-WinRtResult ($manager.StopTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
  if ($result.Status.ToString() -ne 'Success') {
    throw "Unable to stop hotspot: $($result.Status) $($result.AdditionalErrorMessage)"
  }
}

$current = $manager.GetCurrentAccessPointConfiguration()
[pscustomobject]@{
  internetProfile = $profile.ProfileName
  internetLevel = $profile.GetNetworkConnectivityLevel().ToString()
  hotspotState = $manager.TetheringOperationalState.ToString()
  hotspotSsid = $current.Ssid
  hotspotBand = $current.Band.ToString()
  noClientsTimeoutEnabled = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::IsNoConnectionsTimeoutEnabled()
  connectedClients = $manager.ClientCount
  maxClients = $manager.MaxClientCount
} | ConvertTo-Json -Compress
