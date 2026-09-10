# Regne — Mathematical CAS Document Workspace

**Regne** is a Maple-inspired Computer Algebra System (CAS) document workspace built with **Electron, React, TypeScript, and KaTeX**.

Unlike traditional notebook interfaces that divide computation into boxed cells, Regne embraces Maple's **Document Mode**: a continuous, word-processor document flow where text narratives and mathematical evaluations coexist seamlessly on a clean page.

---

## Core Characteristics

- **Continuous Document Flow (No Cells)**:
  - Text and math flow together on a clean white document sheet without notebook cell boxes, left grouping brackets, or hover action toolbars.
  - Type explanations and theorems in normal **Text** mode.
  - Switch to **Math** mode (or press `F5` / click `Math` in the ribbon) to enter mathematical expressions.
  - Press `Enter` on any math line: the expression evaluates in-place and its royal blue typeset result renders directly underneath.
- **Dialed-Back, Restrained UI**:
  - Distraction-free desktop interface focused on document composition.
  - Clean top ribbon: `Text / Math` mode toggle (`F5`), `Evaluate` (`Enter`), `+ Math`, `+ Text`, `Save`, `Open`, `Export`.
  - Optional compact mathematical symbol palette for inserting calculus templates, Greek letters, and common symbols.
- **Extensible CAS Solver Architecture**:
  - Full decoupling between document rendering and mathematical computation.
  - Well-defined `ICasEngine` interface ready for future solvers (such as Python SymPy, Giac, Math.js, or WebAssembly engines).
  - Built-in reference **Mock CAS Engine** providing symbolic transforms, calculus, polynomial expansions, factoring, equation solving, and session variables (`radius := 5;`).
- **File Serialization & Export**:
  - Save and Open `.regne` JSON document files (with backwards-compatible `.hypatia` support).
  - Export directly to **LaTeX** (`.tex`) and **Interactive HTML** (`.html`).

---

## Project Architecture

```
wise-regne/
├── src/
│   ├── main/
│   │   ├── main.ts              # Electron window lifecycle & file dialog IPCs
│   │   └── menu.ts              # Native application menu
│   ├── preload/
│   │   └── index.ts             # Secure contextBridge (window.regneAPI)
│   ├── engine/                  # Pluggable CAS Solver Layer
│   │   ├── types.ts             # ICasEngine abstraction contract
│   │   ├── engineManager.ts     # Solver registry, lifecycle & queue management
│   │   ├── mockEngine.ts        # Built-in reference symbolic CAS engine
│   │   ├── pythonSympyBridge.ts # Template adapter for external Python/SymPy solvers
│   │   └── README.md            # Solver integration guide
│   ├── renderer/
│   │   ├── App.tsx              # Clean document layout
│   │   ├── main.tsx             # React entry point
│   │   ├── index.css            # KaTeX & typography styles
│   │   ├── context/
│   │   │   ├── DocumentContext.tsx # Continuous document flow & evaluation
│   │   │   └── EngineContext.tsx   # React provider bridging CAS engine events
│   │   └── components/
│   │       ├── Worksheet/
│   │       │   ├── DocumentEditor.tsx # Continuous document page editor
│   │       │   └── KaTeXRenderer.tsx  # Crisp typeset math rendering
│   │       ├── Palettes/        # Compact symbol & calculus palettes
│   │       ├── Toolbar/         # Minimal document ribbon
│   │       └── Dialogs/         # Clean export dialog
│   └── types/
│       └── document.ts          # Continuous document data model
└── test/
    └── engine.test.ts           # Automated test suite for CAS engine layer
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development mode with Vite hot-reloading
npm run dev

# Start Electron production app
npm start

# Run production build
npm run build

# Run automated CAS engine tests
npm test
```

---

## Connecting a Future CAS Solver

Implement `ICasEngine` in [`src/engine/types.ts`](file:///Users/vdaugb/Documents/antigravity/wise-hypatia/src/engine/types.ts):

```typescript
import { ICasEngine, CasEvaluationRequest, CasEvaluationResult } from './types';

export class MyCustomSolver implements ICasEngine {
  readonly metadata = {
    id: 'my-solver',
    name: 'My Custom Solver',
    version: '1.0.0',
    description: 'External CAS Solver',
    backend: 'python', // or 'wasm', 'javascript', 'native'
    capabilities: {
      symbolicMath: true,
      numericEval: true,
      calculus: true,
      linearAlgebra: true,
      arbitraryPrecision: true,
      customFunctions: true,
    },
    status: 'ready',
  };

  async initialize() {}
  async evaluate(request: CasEvaluationRequest): Promise<CasEvaluationResult> {
    return {
      id: request.id,
      success: true,
      resultLatex: '\\frac{1}{2}',
      resultText: '1/2',
      resultType: 'expression',
      executionTimeMs: 10,
    };
  }
  async interrupt() {}
  async reset() {}
  async getScope() { return {}; }
  async terminate() {}
  onStatusChange(fn) { return () => {}; }
  onScopeChange(fn) { return () => {}; }
}
```

Register with the central manager:
```typescript
import { EngineManager } from './engineManager';
EngineManager.getInstance().registerEngine(new MyCustomSolver());
```
