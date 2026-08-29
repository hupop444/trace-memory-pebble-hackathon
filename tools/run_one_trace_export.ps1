param(
    [Parameter(Mandatory=$true)][ValidateSet('bag_esp32','badge_mini','clip_mini')][string]$VariantName,
    [Parameter(Mandatory=$true)][ValidateSet('back','front','sensor','board')][string]$PartName,
    [string]$OpenScad = 'openscad'
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $workspaceRoot 'cad\TRACE_pebble_parametric.scad'
$exportRoot = Join-Path $workspaceRoot 'exports'
New-Item -ItemType Directory -Force -Path $exportRoot | Out-Null
$output = Join-Path $exportRoot "TRACE_${VariantName}_${PartName}.stl"

& $OpenScad -o $output -D "variant=`"$VariantName`"" -D "part=`"$PartName`"" $source
if ($LASTEXITCODE -ne 0) {
    throw "OpenSCAD failed with exit code $LASTEXITCODE"
}
$item = Get-Item -LiteralPath $output
"OK $VariantName/$PartName $($item.Length) bytes"
