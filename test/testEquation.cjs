const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

async function main() {
  const venvPython = path.resolve(process.cwd(), '.venv/bin/python3');
  const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';
  const workerScript = path.resolve(process.cwd(), 'src/engine/sympyWorker.py');

  const proc = spawn(pythonCmd, ['-u', workerScript], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  proc.stderr.on('data', (d) => console.error('STDERR:', d.toString()));
  proc.on('close', (code) => console.log('EXIT CODE:', code));

  const rl = readline.createInterface({ input: proc.stdout });

  const readyMsg = await new Promise((resolve) => {
    rl.once('line', (line) => resolve(JSON.parse(line.trim())));
  });
  console.log('Ready:', readyMsg);

  const testCodes = [
    '\\sin(\\phi_2) = \\frac{C_{Ay}}{|C_A|}',
    '\\sin(\\phi_2) = \\frac{C_{Ay}}{\\left|C_A\\right|}',
    '\\sin(\\phi_{2}) = \\frac{C_{Ay}}{|C_{A}|}',
    '\\sin\\left(\\phi_2\\right) = \\frac{C_{Ay}}{|C_A|}',
    '\\sin(\\phi_2)',
    '|C_A|',
    '\\frac{C_{Ay}}{|C_A|}',
    '|H_A|^2 = (x_A + x_{A0})^2 + |C_A|^2 - 2 \\cdot (x_A + x_{A0}) \\cdot |C_A| \\cdot \\cos(\\phi_1)',
    '\\frac{\\frac{a}{b}}{c}',
    '|x| + |y|'
  ];

  for (const code of testCodes) {
    console.log('\n--- Testing:', code);
    const p = new Promise((resolve) => {
      const listener = (line) => {
        rl.removeListener('line', listener);
        try {
          resolve(JSON.parse(line.trim()));
        } catch (e) {
          console.error('Failed to parse line:', line);
          resolve(null);
        }
      };
      rl.on('line', listener);
    });

    proc.stdin.write(JSON.stringify({ id: 'test', action: 'eval', code }) + '\n');
    const res = await p;
    console.log('Result:', res);
  }

  proc.kill();
}

main().catch(console.error);
