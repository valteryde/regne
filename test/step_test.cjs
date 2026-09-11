const { spawnSync } = require('child_process');

const pyCode = `
import sys
sys.path.insert(0, 'src/engine')
from sympyWorker import SymPyWorker

worker = SymPyWorker()
raw = r"\\sin(\\phi_2) = \\frac{C_{Ay}}{|C_A|}"
print("1. Raw:", raw, flush=True)
prep = worker.preprocess_code(raw)
print("2. Preprocessed:", prep, flush=True)
`;

const res = spawnSync('.venv/bin/python3', ['-c', pyCode], {
  cwd: process.cwd(),
  encoding: 'utf-8',
  timeout: 5000,
});

console.log('STDOUT:\n', res.stdout);
console.log('STDERR:\n', res.stderr);
console.log('STATUS:\n', res.status);
console.log('ERROR:\n', res.error);
