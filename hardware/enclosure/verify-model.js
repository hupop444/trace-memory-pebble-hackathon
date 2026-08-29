import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const validator = path.resolve(currentDir, '..', '..', 'tools', 'validate_trace_stl.py');
const report = path.resolve(currentDir, '..', '..', '.tmp', 'trace-enclosure-validation.json');
const python = process.env.PYTHON_BIN || 'python';
const result = spawnSync(
  python,
  [
    validator,
    '--input-dir', path.join(currentDir, 'output'),
    '--pattern', 'trace_*.stl',
    '--report', report,
  ],
  { stdio: 'inherit' },
);

if (result.error) {
  throw new Error(`Unable to start Python (${python}): ${result.error.message}`);
}
process.exitCode = result.status ?? 1;
