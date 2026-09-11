import {
  ICasEngine,
  CasEngineMetadata,
  CasEvaluationRequest,
  CasEvaluationResult,
  CasVariable,
  EngineStatusListener,
  EngineScopeListener,
} from './types';

/**
 * MockCasEngine
 * 
 * Reference implementation of ICasEngine supporting both 2D LaTeX (from MathLive)
 * and Maple text notation, with session scope and symbolic evaluation.
 */
export class MockCasEngine implements ICasEngine {
  public readonly metadata: CasEngineMetadata = {
    id: 'mock-engine',
    name: 'Regne Mock Engine (Solver Ready)',
    version: '1.0.0',
    description: 'Reference CAS engine with 2D WYSIWYG LaTeX support and scope management',
    backend: 'javascript',
    capabilities: {
      symbolicMath: true,
      numericEval: true,
      calculus: true,
      linearAlgebra: true,
      arbitraryPrecision: false,
      customFunctions: true,
    },
    status: 'uninitialized',
  };

  private scope: Record<string, CasVariable> = {};
  private statusListeners: Set<EngineStatusListener> = new Set();
  private scopeListeners: Set<EngineScopeListener> = new Set();
  private isInterrupted: boolean = false;

  public async initialize(): Promise<void> {
    this.setStatus('ready');
    this.scope['Pi'] = {
      name: 'Pi',
      type: 'constant',
      valueLatex: '\\pi',
      valueText: '3.1415926535...',
      assignedAt: Date.now(),
    };
    this.scope['e'] = {
      name: 'e',
      type: 'constant',
      valueLatex: 'e',
      valueText: '2.7182818284...',
      assignedAt: Date.now(),
    };
    this.notifyScopeChange();
  }

  public async evaluate(request: CasEvaluationRequest): Promise<CasEvaluationResult> {
    const startTime = performance.now();
    this.setStatus('busy');
    this.isInterrupted = false;

    await new Promise((r) => setTimeout(r, 30));

    if (this.isInterrupted) {
      this.setStatus('ready');
      return {
        id: request.id,
        success: false,
        resultType: 'error',
        executionTimeMs: performance.now() - startTime,
        error: 'Evaluation interrupted by user.',
      };
    }

    try {
      let code = request.code.trim();
      if (code.endsWith(';')) {
        code = code.slice(0, -1).trim();
      }

      // Strip LaTeX operator wrappers (\operatorname{fn} -> fn)
      code = code.replace(/\\(?:operatorname|mathrm|text|mathit|mathbf)\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, '$1');

      if (!code) {
        this.setStatus('ready');
        return {
          id: request.id,
          success: true,
          resultType: 'void',
          executionTimeMs: performance.now() - startTime,
        };
      }

      // Variable assignment: `var := expr`
      const assignmentMatch = code.match(/^([a-zA-Z_][a-zA-Z0-9_]*(?:\s*\([a-zA-Z0-9_,\s]*\))?)\s*:=\s*(.+)$/);
      if (assignmentMatch) {
        const target = assignmentMatch[1].trim();
        const valueExpr = assignmentMatch[2].trim();
        const valueLatex = this.toLatex(valueExpr);

        const newVar: CasVariable = {
          name: target,
          type: target.includes('(') ? 'function' : 'symbol',
          valueLatex,
          valueText: valueExpr,
          assignedAt: Date.now(),
        };

        this.scope[target] = newVar;
        this.notifyScopeChange();
        this.setStatus('ready');

        return {
          id: request.id,
          success: true,
          resultLatex: `${this.varNameToLatex(target)} := ${valueLatex}`,
          resultText: `${target} := ${valueExpr}`,
          resultType: 'equation',
          assignedVariables: [newVar],
          executionTimeMs: performance.now() - startTime,
        };
      }

      // Restart / clear
      if (code === 'restart' || code === 'clear') {
        await this.reset();
        this.setStatus('ready');
        return {
          id: request.id,
          success: true,
          resultLatex: '\\text{Session reset. All variables cleared.}',
          resultText: 'Session reset. All variables cleared.',
          resultType: 'text',
          executionTimeMs: performance.now() - startTime,
        };
      }

      // Plot command handling
      if (code.startsWith('plot(') || code.startsWith('\\operatorname{plot}(')) {
        this.setStatus('ready');
        return {
          id: request.id,
          success: true,
          resultType: 'plot',
          resultLatex: '\\text{Plot}',
          resultText: code,
          plotSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="400" height="250"><rect width="400" height="250" fill="#f8fafc" stroke="#cbd5e1"/><line x1="50" y1="200" x2="350" y2="200" stroke="#64748b" stroke-width="1.5"/><line x1="200" y1="20" x2="200" y2="230" stroke="#64748b" stroke-width="1.5"/><path d="M 50 180 Q 200 40 350 180" fill="none" stroke="#242e84" stroke-width="2.5"/><text x="200" y="240" text-anchor="middle" font-size="12" fill="#64748b">x</text><text x="30" y="125" text-anchor="middle" font-size="12" fill="#64748b">y</text></svg>',
          executionTimeMs: performance.now() - startTime,
        };
      }

      // Check symbolic transforms (Calculus, Algebra, Solvers)
      const mockResult = this.applyMockCasTransforms(code);
      if (mockResult) {
        this.setStatus('ready');
        return {
          id: request.id,
          success: true,
          resultLatex: mockResult.latex,
          resultText: mockResult.text,
          resultType: mockResult.type,
          executionTimeMs: performance.now() - startTime,
        };
      }

      // Format expression
      const formattedLatex = this.toLatex(code);
      this.setStatus('ready');
      return {
        id: request.id,
        success: true,
        resultLatex: formattedLatex,
        resultText: code,
        resultType: 'expression',
        executionTimeMs: performance.now() - startTime,
      };

    } catch (err: any) {
      this.setStatus('error');
      return {
        id: request.id,
        success: false,
        resultType: 'error',
        executionTimeMs: performance.now() - startTime,
        error: err?.message || 'CAS Engine evaluation error',
      };
    }
  }

  public async interrupt(): Promise<void> {
    this.isInterrupted = true;
    this.setStatus('interrupted');
    setTimeout(() => this.setStatus('ready'), 200);
  }

  public async reset(): Promise<void> {
    this.scope = {
      Pi: {
        name: 'Pi',
        type: 'constant',
        valueLatex: '\\pi',
        valueText: '3.1415926535...',
        assignedAt: Date.now(),
      },
      e: {
        name: 'e',
        type: 'constant',
        valueLatex: 'e',
        valueText: '2.7182818284...',
        assignedAt: Date.now(),
      },
    };
    this.notifyScopeChange();
  }

  public async getScope(): Promise<Record<string, CasVariable>> {
    return { ...this.scope };
  }

  public async terminate(): Promise<void> {
    this.setStatus('terminated');
    this.statusListeners.clear();
    this.scopeListeners.clear();
  }

  public onStatusChange(listener: EngineStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.metadata.status);
    return () => this.statusListeners.delete(listener);
  }

  public onScopeChange(listener: EngineScopeListener): () => void {
    this.scopeListeners.add(listener);
    listener(this.scope);
    return () => this.scopeListeners.delete(listener);
  }

  private setStatus(status: CasEngineMetadata['status']): void {
    this.metadata.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  private notifyScopeChange(): void {
    for (const listener of this.scopeListeners) {
      listener(this.scope);
    }
  }

  /** Converts a plain variable name like E_pot into LaTeX E_{pot}. */
  private varNameToLatex(name: string): string {
    // Replace _foo (multi-char subscript) with _{foo}; single-char _x stays as-is
    return name.replace(/_([a-zA-Z0-9]{2,})/g, '_{$1}');
  }

  public toLatex(expr: string): string {
    // If it's already LaTeX from MathLive, return cleaned LaTeX
    if (expr.includes('\\frac') || expr.includes('\\int') || expr.includes('\\sum') || expr.includes('\\left') || expr.includes('^')) {
      return expr;
    }

    let clean = expr.trim();
    if (clean.endsWith(';')) clean = clean.slice(0, -1).trim();

    const greekMap: Record<string, string> = {
      alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma',
      epsilon: '\\epsilon', theta: '\\theta', lambda: '\\lambda', mu: '\\mu',
      pi: '\\pi', Pi: '\\pi', rho: '\\rho', sigma: '\\sigma', phi: '\\phi',
      omega: '\\omega', Gamma: '\\Gamma', Theta: '\\Theta',
      Lambda: '\\Lambda', Sigma: '\\Sigma', Phi: '\\Phi', Omega: '\\Omega',
      infinity: '\\infty',
    };

    if (greekMap[clean]) return greekMap[clean];

    clean = clean.replace(/diff\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, '\\frac{d}{d $2} \\left( $1 \\right)');
    clean = clean.replace(/int\s*\(\s*([^,]+)\s*,\s*([^,\)]+)\s*=\s*([^.]*)\.\.([^)]*)\)/g, '\\int_{$3}^{$4} $1 \\, d$2');
    clean = clean.replace(/int\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, '\\int $1 \\, d$2');
    clean = clean.replace(/sum\s*\(\s*([^,]+)\s*,\s*([^=]+)=([^.]*)\.\.([^)]*)\)/g, '\\sum_{$2=$3}^{$4} $1');
    clean = clean.replace(/sqrt\s*\(([^)]+)\)/g, '\\sqrt{$1}');
    clean = clean.replace(/\b(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|exp|ln|log)\s*\(([^)]+)\)/g, '\\$1\\left($2\\right)');
    clean = clean.replace(/\^([a-zA-Z0-9]+)/g, '^{$1}');
    clean = clean.replace(/([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)/g, '\\frac{$1}{$2}');
    clean = clean.replace(/\s*\*\s*/g, ' \\cdot ');

    for (const [word, latex] of Object.entries(greekMap)) {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      clean = clean.replace(regex, latex);
    }

    return clean;
  }

  /**
   * Evaluates expressions coming from either MathLive LaTeX or standard text notation
   */
  private applyMockCasTransforms(code: string): { latex: string; text: string; type: CasEvaluationResult['resultType'] } | null {
    // Normalize string: strip spaces, backslashes for standard symbols, \left, \right
    const norm = code
      .replace(/\\(?:operatorname|mathrm|text|mathit|mathbf)\{([^}]+)\}/g, '$1')
      .replace(/\s+/g, '')
      .replace(/\\left/g, '')
      .replace(/\\right/g, '')
      .replace(/\\,/g, '')
      .replace(/;$/, '');

    // Calculus: Derivatives (supports both diff(sin(x), x) and \frac{d}{dx}\sin(x))
    if (norm === 'diff(sin(x),x)' || norm === '\\frac{d}{dx}(\\sin(x))' || norm === '\\frac{d}{dx}\\sin(x)' || norm.includes('{d}{dx}\\sin(x)')) {
      return { latex: '\\cos\\left(x\\right)', text: 'cos(x)', type: 'expression' };
    }
    if (norm === 'diff(cos(x),x)' || norm === '\\frac{d}{dx}(\\cos(x))' || norm === '\\frac{d}{dx}\\cos(x)' || norm.includes('{d}{dx}\\cos(x)')) {
      return { latex: '-\\sin\\left(x\\right)', text: '-sin(x)', type: 'expression' };
    }
    if (norm === 'diff(exp(x),x)' || norm.includes('{d}{dx}e^{x}') || norm.includes('{d}{dx}\\exp(x)')) {
      return { latex: 'e^{x}', text: 'exp(x)', type: 'expression' };
    }
    if (norm === 'diff(x^2,x)' || norm.includes('{d}{dx}x^{2}') || norm.includes('{d}{dx}x^2')) {
      return { latex: '2x', text: '2*x', type: 'expression' };
    }
    if (norm === 'diff(x^n,x)' || norm.includes('{d}{dx}x^{n}')) {
      return { latex: 'n x^{n-1}', text: 'n*x^(n-1)', type: 'expression' };
    }

    // Calculus: Integrals (supports int(x^2, x) and \int x^2 dx)
    if (norm === 'int(sin(x),x)' || norm.includes('\\int\\sin(x)dx')) {
      return { latex: '-\\cos\\left(x\\right) + C', text: '-cos(x) + C', type: 'expression' };
    }
    if (norm === 'int(cos(x),x)' || norm.includes('\\int\\cos(x)dx')) {
      return { latex: '\\sin\\left(x\\right) + C', text: 'sin(x) + C', type: 'expression' };
    }
    if (norm === 'int(x^2,x)' || norm.includes('\\intx^{2}dx') || norm.includes('\\intx^2dx')) {
      return { latex: '\\frac{1}{3} x^{3} + C', text: '1/3*x^3 + C', type: 'expression' };
    }
    if (norm === 'int(exp(x),x)' || norm.includes('\\inte^{x}dx')) {
      return { latex: 'e^{x} + C', text: 'exp(x) + C', type: 'expression' };
    }
    if (norm === 'int(1/x,x)' || norm.includes('\\int\\frac{1}{x}dx')) {
      return { latex: '\\ln\\left|x\\right| + C', text: 'ln(|x|) + C', type: 'expression' };
    }

    // Polynomial Expansion
    if (norm === 'expand((x+1)^2)' || norm === '(x+1)^{2}' || norm === '(x+1)^2') {
      return { latex: 'x^{2} + 2x + 1', text: 'x^2 + 2*x + 1', type: 'expression' };
    }
    if (norm === 'expand((x+1)^3)' || norm === '(x+1)^{3}' || norm === '(x+1)^3') {
      return { latex: 'x^{3} + 3x^{2} + 3x + 1', text: 'x^3 + 3*x^2 + 3*x + 1', type: 'expression' };
    }

    // Factoring
    if (norm === 'factor(x^2-1)' || norm === 'factor(x^{2}-1)') {
      return { latex: '\\left(x - 1\\right)\\left(x + 1\\right)', text: '(x - 1)*(x + 1)', type: 'expression' };
    }
    if (norm === 'factor(x^2-4)' || norm === 'factor(x^{2}-4)') {
      return { latex: '\\left(x - 2\\right)\\left(x + 2\\right)', text: '(x - 2)*(x + 2)', type: 'expression' };
    }

    // Equation Solving
    if (
      norm === 'solve(x+2=0)' ||
      norm === 'solve(x+2=0,x)' ||
      norm === 'x+2=0'
    ) {
      return { latex: '\\left\\{ x = -2 \\right\\}', text: '{x = -2}', type: 'equation' };
    }
    if (norm === 'solve(x^2-4=0,x)' || norm === 'solve(x^2-4=0)' || norm === 'x^{2}-4=0' || norm === 'x^2-4=0') {
      return { latex: '\\left\\{ x = -2, \\; x = 2 \\right\\}', text: '{x = -2, x = 2}', type: 'equation' };
    }
    if (norm === 'solve(2*x+4=0,x)' || norm === 'solve(2x+4=0,x)' || norm === 'solve(2*x+4=0)' || norm === 'solve(2x+4=0)' || norm === '2x+4=0' || norm === '2*x+4=0') {
      return { latex: '\\left\\{ x = -2 \\right\\}', text: '{x = -2}', type: 'equation' };
    }

    // Arithmetic
    if (/^[0-9+\-*/().\s^]+$/.test(code) && !code.includes(':=') && !code.includes('=')) {
      try {
        const sanitized = code.replace(/\^/g, '**');
        // eslint-disable-next-line no-eval
        const val = Function(`'use strict'; return (${sanitized})`)();
        if (typeof val === 'number' && !isNaN(val)) {
          return {
            latex: String(Number.isInteger(val) ? val : Number(val.toFixed(8))),
            text: String(val),
            type: 'expression',
          };
        }
      } catch {
        // Fall back
      }
    }

    return null;
  }
}
