$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js 22.13 or newer is required.'
}

$nodeVersion = [Version]((node --version).TrimStart('v'))
if ($nodeVersion -lt [Version]'22.13.0') {
  throw "Node.js 22.13 or newer is required; found $nodeVersion."
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw 'Python 3.10 or newer is required for STL verification.'
}
$pythonVersionText = (& python -c 'import platform; print(platform.python_version())').Trim()
if ($LASTEXITCODE -ne 0 -or [Version]$pythonVersionText -lt [Version]'3.10.0') {
  throw "Python 3.10 or newer is required; found $pythonVersionText."
}

foreach ($project in @('software', 'hardware\bridge', 'hardware\enclosure')) {
  $path = Join-Path $repoRoot $project
  Write-Host "Installing $project"
  Push-Location $path
  try {
    & npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed for $project." }
  }
  finally { Pop-Location }
}

Write-Host 'TRACE dependencies are ready.'
