const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const fs = require('fs');
const { EngineManager } = require('../dist/engine/engineManager');
const { PythonSymPyBridge } = require('../dist/engine/pythonSympyBridge');

async function testSympyWorker() {
  console.log('--- Testing SymPy CAS Daemon Process ---');

  const venvPython = path.resolve(process.cwd(), '.venv/bin/python3');
  const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';
  const workerScript = path.resolve(process.cwd(), 'src/engine/sympyWorker.py');

  console.log(`Using Python executable: ${pythonCmd}`);

  const proc = spawn(pythonCmd, ['-u', workerScript], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rl = readline.createInterface({ input: proc.stdout });

  const send = (payload) => {
    return new Promise((resolve) => {
      const listener = (line) => {
        try {
          const data = JSON.parse(line.trim());
          if (data.id === payload.id) {
            rl.removeListener('line', listener);
            resolve(data);
          }
        } catch (e) {}
      };
      rl.on('line', listener);
      proc.stdin.write(JSON.stringify(payload) + '\n');
    });
  };

  // Wait for ready message
  const readyMsg = await new Promise((resolve) => {
    rl.once('line', (line) => resolve(JSON.parse(line.trim())));
  });

  console.assert(readyMsg.status === 'ready', `Expected ready status, got: ${JSON.stringify(readyMsg)}`);
  console.log(`✓ SymPy Worker spawned successfully (SymPy v${readyMsg.version})`);

  // Test 1: Derivatives
  const diffRes = await send({ id: 'diff1', action: 'eval', code: 'diff(sin(x)*cos(x), x)' });
  console.assert(diffRes.success, 'Diff failed');
  console.assert(diffRes.resultLatex.includes('\\cos') || diffRes.resultLatex.includes('\\sin'), 'Diff LaTeX invalid');
  console.log('✓ diff(sin(x)*cos(x), x) ->', diffRes.resultLatex);

  // Test 2: Indefinite Integration
  const intRes = await send({ id: 'int1', action: 'eval', code: 'int(x^2 * exp(x), x)' });
  console.assert(intRes.success, 'Integral failed');
  console.assert(intRes.resultLatex.includes('e^{x}'), 'Integral LaTeX invalid');
  console.log('✓ int(x^2 * exp(x), x) ->', intRes.resultLatex);

  // Test 3: Equation Solving
  const solveRes = await send({ id: 'solve1', action: 'eval', code: 'solve(x^2 - 5 = 0, x)' });
  console.assert(solveRes.success && solveRes.resultType === 'equation', 'Solve failed');
  console.assert(solveRes.resultLatex.includes('\\sqrt{5}'), 'Solve LaTeX missing sqrt(5)');
  console.log('✓ solve(x^2 - 5 = 0, x) ->', solveRes.resultLatex);

  // Test 3b: solve(x + 2 = 0) (no variable passed, single equation)
  const solveLinearRes = await send({ id: 'solve2', action: 'eval', code: 'solve(x + 2 = 0)' });
  console.assert(solveLinearRes.success && solveLinearRes.resultType === 'equation', 'Solve x + 2 = 0 failed');
  console.assert(solveLinearRes.resultLatex.includes('-2'), 'Solve x + 2 = 0 result invalid');
  console.log('✓ solve(x + 2 = 0) ->', solveLinearRes.resultLatex);

  // Test 3c: solve (x + 2 = 0) with whitespace
  const solveSpaceRes = await send({ id: 'solve3', action: 'eval', code: 'solve (x + 2 = 0)' });
  console.assert(solveSpaceRes.success && solveSpaceRes.resultLatex.includes('-2'), 'Solve with whitespace failed');
  console.log('✓ solve (x + 2 = 0) ->', solveSpaceRes.resultLatex);

  // Test 3d: Standalone equation x + 2 = 0
  const standaloneEqRes = await send({ id: 'solve4', action: 'eval', code: 'x + 2 = 0' });
  console.assert(standaloneEqRes.success && standaloneEqRes.resultLatex.includes('-2'), 'Standalone equation failed');
  console.log('✓ x + 2 = 0 ->', standaloneEqRes.resultLatex);

  // Test 4: LaTeX MathLive Derivative notation
  const latexRes = await send({ id: 'latex1', action: 'eval', code: '\\frac{d}{dx}(x^4)' });
  console.assert(latexRes.success, 'LaTeX diff failed');
  console.assert(latexRes.resultLatex.includes('4'), 'LaTeX result unexpected');
  console.log('✓ \\frac{d}{dx}(x^4) ->', latexRes.resultLatex);

  // Test 5: Variable Assignment & Scope
  const assignRes = await send({ id: 'assign1', action: 'eval', code: 'radius := 12' });
  console.assert(assignRes.success && assignRes.resultType === 'equation', 'Assign failed');
  console.log('✓ radius := 12 ->', assignRes.resultLatex);

  const scopeRes = await send({ id: 'scope1', action: 'scope' });
  console.assert(scopeRes.success && scopeRes.scope['radius'], 'Scope missing radius');
  console.log('✓ Verified variable in session scope. Variables count:', Object.keys(scopeRes.scope).length);

  proc.kill();
}

async function testEngineManager() {
  console.log('\n--- Testing EngineManager Architecture ---');
  const manager = EngineManager.getInstance();
  await manager.initialize();

  const active = manager.getActiveEngine();
  console.assert(active.metadata.id === 'python-sympy', 'Default engine should be python-sympy');
  console.log(`✓ EngineManager active solver: "${active.metadata.name}" (${active.metadata.backend})`);
  console.log(`✓ Solver capabilities: Symbolic Math (${active.metadata.capabilities.symbolicMath}), Calculus (${active.metadata.capabilities.calculus})`);
}

async function runAll() {
  await testSympyWorker();
  await testEngineManager();
  console.log('\nAll Regne SymPy CAS Engine tests passed successfully!');
}

runAll().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
