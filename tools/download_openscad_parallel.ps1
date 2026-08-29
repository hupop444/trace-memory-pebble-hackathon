param(
    [string]$ScratchRoot = (Join-Path ([System.IO.Path]::GetTempPath()) 'trace-pebble-cad')
)

$ErrorActionPreference = 'Stop'
$downloadUrl = 'https://files.openscad.org/OpenSCAD-2021.01-x86-64.zip'
New-Item -ItemType Directory -Force -Path $ScratchRoot | Out-Null

$ranges = @(
    '0-2735576',
    '2735577-5471153',
    '5471154-8206730',
    '8206731-10942307',
    '10942308-13677884',
    '13677885-16413461',
    '16413462-19149038',
    '19149039-21884612'
)

$processes = @()
for ($index = 0; $index -lt $ranges.Count; $index++) {
    $target = Join-Path $ScratchRoot "oscad.part$index"
    $arguments = @(
        '-L', '--retry', '8', '--retry-delay', '1',
        '--range', $ranges[$index], '-sS',
        '-o', $target, $downloadUrl
    )
    $processes += Start-Process -FilePath 'curl.exe' -WindowStyle Hidden -PassThru -ArgumentList $arguments
}

Wait-Process -Id ($processes.Id)
foreach ($process in $processes) {
    $process.Refresh()
    if ($process.ExitCode -ne 0) {
        throw "curl process $($process.Id) failed with exit code $($process.ExitCode)"
    }
}

$zipPath = Join-Path $ScratchRoot 'OpenSCAD-2021.01-x86-64.zip'
$output = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
try {
    for ($index = 0; $index -lt $ranges.Count; $index++) {
        $partPath = Join-Path $ScratchRoot "oscad.part$index"
        $bytes = [System.IO.File]::ReadAllBytes($partPath)
        $output.Write($bytes, 0, $bytes.Length)
    }
}
finally {
    $output.Dispose()
}

$item = Get-Item -LiteralPath $zipPath
if ($item.Length -ne 21884613) {
    throw "Unexpected ZIP size: $($item.Length)"
}

$installRoot = Join-Path $ScratchRoot 'openscad'
Expand-Archive -LiteralPath $zipPath -DestinationPath $installRoot -Force
Get-ChildItem -LiteralPath $installRoot -Filter 'openscad.com' -Recurse | Select-Object -First 1 -ExpandProperty FullName
