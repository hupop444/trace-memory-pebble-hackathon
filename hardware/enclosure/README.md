# TRACE enclosure prototype

Parametric two-part enclosure for the current full-size ESP32-S3 prototype.
`trace_enclosure.scad` is the authoritative print model.

- `trace_base.stl`: rigid PLA/PETG base with board rails, USB window and lanyard hole.
- `trace_pressure_lid.stl`: pressure lid with an 18 mm FSR pocket and wire channel.
- `trace_enclosure.scad`: the single source of truth for fit-critical dimensions.
- `model.js` and `dimensions.js`: preserved early JSCAD exploration; they are not used for release exports.

The current numbers are conservative placeholders until the physical assembly is measured.

Build with OpenSCAD available on `PATH`:

```powershell
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$source = Join-Path $root 'hardware\enclosure\trace_enclosure.scad'
$output = Join-Path $root 'hardware\enclosure\output'
New-Item -ItemType Directory -Force -Path $output | Out-Null
openscad -o (Join-Path $output 'trace_base.stl') -D 'part=1' $source
openscad -o (Join-Path $output 'trace_pressure_lid.stl') -D 'part=2' $source
```

The repository-level commands use the same authoritative path:

```powershell
npm run build
npm run verify
```

`npm run verify` performs dependency-free manifold QA on the two exported STL files and fails on an open edge, multiple component, degenerate triangle, or missing export.

Suggested first print:

- Base: PLA, 0.20 mm layer, 3 walls, 15% gyroid, no supports.
- Lid: TPU 95A preferred; PLA is acceptable for a fit test.
- Place a 3 mm EVA pressure spreader between the raised pad and the FSR disc.
