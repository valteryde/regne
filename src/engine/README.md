# Regne CAS Solver Architecture & Integration Guide

Regne is designed from the ground up with a decoupled **Computer Algebra System (CAS) Engine Architecture**. The document interface (worksheets, palettes, red prompts, centered royal blue math typesetting) is completely isolated from the mathematical solver backend.

---

## The `ICasEngine` Interface

To plug any mathematical solver into Regne, implement the `ICasEngine` interface defined in `src/engine/types.ts`:

```typescript
export interface ICasEngine {
  readonly metadata: CasEngineMetadata;
  
  initialize(): Promise<void>;
  evaluate(request: CasEvaluationRequest): Promise<CasEvaluationResult>;
  interrupt(): Promise<void>;
  reset(): Promise<void>;
  getScope(): Promise<Record<string, CasVariable>>;
  terminate(): Promise<void>;
  onStatusChange(listener: EngineStatusListener): () => void;
  onScopeChange(listener: EngineScopeListener): () => void;
}
```

### Key Return Values for `evaluate()`
When evaluating user math expressions or commands, your engine should return:
- `resultLatex`: LaTeX representation rendered in blue at the center of the worksheet (e.g. `\frac{1}{3}x^3 + C`).
- `resultText`: Plain text representation (e.g. `1/3*x^3 + C`).
- `resultType`: `'expression' | 'equation' | 'matrix' | 'plot' | 'text' | 'error' | 'void'`.
- `plotData`: (Optional) coordinate data `{ series: [{ x: [...], y: [...] }] }` for graphic rendering.
- `assignedVariables`: List of any variables/functions bound to session scope during this evaluation.
- `executionTimeMs`: Wall clock computation time in milliseconds.

---

## Registering Your Engine

Once your engine class is implemented, register it with the singleton `EngineManager`:

```typescript
import { EngineManager } from './engineManager';
import { MyCustomCasEngine } from './myCustomCasEngine';

// Instantiate and register
const myEngine = new MyCustomCasEngine();
EngineManager.getInstance().registerEngine(myEngine);

// Optionally make it the active engine
await EngineManager.getInstance().switchEngine(myEngine.metadata.id);
```

---

## Typical Solver Integration Patterns

### 1. Python + SymPy Solver
1. Spawn a Python daemon via Electron `child_process.spawn('python3', ['-u', 'solver_worker.py'])`.
2. Communicate via newline-delimited JSON over `stdin` / `stdout`.
3. In Python, use `sympy.sympify(code)` and output `sympy.latex(result)`.
4. Send `SIGINT` on `interrupt()`.

### 2. WebAssembly Solver (e.g. Giac / Xcas)
1. Load Giac compiled to WebAssembly (`giac.wasm`).
2. Run inside a dedicated `Web Worker` to keep the UI silky smooth.
3. Post message `{ type: 'EVAL', code }` and receive `{ type: 'RESULT', latex }`.

### 3. Pure JavaScript Solver (e.g. Math.js or Algebrite)
1. Import the library.
2. Parse AST and generate output format.
3. Return results directly inside `evaluate()`.
