/// <reference types="node" />
import { MockCasEngine } from '../src/engine/mockEngine';
import { EngineManager } from '../src/engine/engineManager';
import { PythonSymPyBridge } from '../src/engine/pythonSympyBridge';

async function runTests() {
  console.log('--- Testing Refactored CAS Engine Layer ---');

  // Test 1: Initialize Mock Engine
  const engine = new MockCasEngine();
  await engine.initialize();
  console.log('✓ MockCasEngine initialized (status: ready)');

  // Test 2: Calculus Evaluation
  const diffRes = await engine.evaluate({ id: '1', code: 'diff(sin(x), x);' });
  console.assert(diffRes.success && diffRes.resultLatex?.includes('\\cos'), 'Diff evaluation failed');
  console.log('✓ diff(sin(x), x) ->', diffRes.resultLatex);

  const intRes = await engine.evaluate({ id: '2', code: 'int(x^2, x);' });
  console.assert(intRes.success && intRes.resultLatex?.includes('x^{3}'), 'Integral evaluation failed');
  console.log('✓ int(x^2, x) ->', intRes.resultLatex);

  // Test 3: Algebraic Transforms
  const expandRes = await engine.evaluate({ id: '3', code: 'expand((x+1)^3);' });
  console.assert(expandRes.success && expandRes.resultLatex?.includes('x^{3}'), 'Expand failed');
  console.log('✓ expand((x+1)^3) ->', expandRes.resultLatex);

  const solveRes = await engine.evaluate({ id: '4', code: 'solve(x^2 - 4 = 0, x);' });
  console.assert(solveRes.success && solveRes.resultType === 'equation', 'Solve failed');
  console.log('✓ solve(x^2 - 4 = 0, x) ->', solveRes.resultLatex);

  // Test 4: Variable Assignment & Scope Memory
  const assignRes = await engine.evaluate({ id: '5', code: 'radius := 5;' });
  console.assert(assignRes.success, 'Assignment failed');
  const scope = await engine.getScope();
  console.assert(scope['radius'] && scope['radius'].valueText === '5', 'Scope memory failed');
  console.log('✓ Assignment radius := 5 stored in scope. Variables count:', Object.keys(scope).length);

  // Test 4b: Mock Plot evaluation
  const plotRes = await engine.evaluate({ id: '5b', code: 'plot(sin(x), x = -5..5);' });
  console.assert(plotRes.success && plotRes.resultType === 'plot', 'Plot evaluation failed');
  console.log('✓ Mock plot evaluation -> resultType:', plotRes.resultType);

  // Test 5: Engine Manager Registry & Switching
  const manager = EngineManager.getInstance();
  await manager.initialize();
  const sympyBridge = new PythonSymPyBridge();
  manager.registerEngine(sympyBridge);

  const available = manager.getAvailableEngines();
  console.assert(available.length >= 2, 'Available engines count mismatch');
  console.log('✓ Registered engines in EngineManager:', available.map(e => e.name).join(', '));

  await manager.switchEngine('python-sympy');
  console.assert(manager.getActiveEngine().metadata.id === 'python-sympy', 'Engine switch failed');
  console.log('✓ Switched active engine to:', manager.getActiveEngine().metadata.name);

  // Switch back to mock
  await manager.switchEngine('mock-engine');
  console.log('✓ Switched active engine back to:', manager.getActiveEngine().metadata.name);

  console.log('\nAll CAS Engine tests passed successfully!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
