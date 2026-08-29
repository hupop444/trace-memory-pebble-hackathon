import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(currentDir, 'trace_enclosure.scad');
const outputDir = path.join(currentDir, 'output');
const openScad = process.env.OPENSCAD_BIN || 'openscad';

fs.mkdirSync(outputDir, { recursive: true });

for (const [filename, part] of [
  ['trace_base.stl', 1],
  ['trace_pressure_lid.stl', 2],
]) {
  const result = spawnSync(
    openScad,
    [
      '--export-format',
      'asciistl',
      '-o',
      path.join(outputDir, filename),
      '-D',
      `part=${part}`,
      source,
    ],
    { stdio: 'inherit' },
  );
  if (result.error) {
    throw new Error(`Unable to start OpenSCAD (${openScad}): ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`OpenSCAD failed while generating ${filename} (exit ${result.status}).`);
  }
}

console.log(`Generated authoritative OpenSCAD exports in ${outputDir}`);
