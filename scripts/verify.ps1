$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location (Join-Path $repoRoot 'software')
try {
  & npm run lint
  if ($LASTEXITCODE -ne 0) { throw 'Software lint failed.' }
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Software build failed.' }
} finally { Pop-Location }

Push-Location (Join-Path $repoRoot 'hardware\enclosure')
try {
  & npm run verify
  if ($LASTEXITCODE -ne 0) { throw 'Enclosure verification failed.' }
} finally { Pop-Location }

Push-Location (Join-Path $repoRoot 'hardware\bridge')
try {
  & node ..\tools\test-software-contract.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Hardware/software contract test failed.' }
} finally { Pop-Location }

Write-Host 'All TRACE verification checks passed.'
