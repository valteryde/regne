import { ComputeEngine } from '@cortex-js/compute-engine';
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
 * ComputeEngineAdapter
 * 
 * An in-process, high-performance Computer Algebra System (CAS) engine
 * powered by CortexJS ComputeEngine (@cortex-js/compute-engine).
 * 
 * Runs natively in both Electron desktop and Vite web environments
 * with zero external runtime dependencies.
 */
export class ComputeEngineAdapter implements ICasEngine {
  public readonly metadata: CasEngineMetadata = {
    id: 'compute-engine',
    name: 'ComputeEngine (JavaScript CAS)',
    version: '0.110.0',
    description: 'Fast in-process symbolic engine supporting calculus, algebra, and LaTeX math',
    backend: 'javascript',
    capabilities: {
      symbolicMath: true,
      numericEval: true,
      calculus: true,
      linearAlgebra: true,
      arbitraryPrecision: true,
      customFunctions: true,
    },
    status: 'uninitialized',
  };

  private ce!: ComputeEngine;
  private scope: Record<string, CasVariable> = {};
  private statusListeners: Set<EngineStatusListener> = new Set();
  private scopeListeners: Set<EngineScopeListener> = new Set();
  private isInterrupted: boolean = false;

  public async initialize(): Promise<void> {
    this.ce = new ComputeEngine();
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
    this.setStatus('ready');
    this.notifyScopeChange();
  }

  public async evaluate(request: CasEvaluationRequest): Promise<CasEvaluationResult> {
    const startTime = performance.now();
    this.setStatus('busy');
    this.isInterrupted = false;

    if (!this.ce) {
      await this.initialize();
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

      // Check for session reset commands
      if (code === 'restart' || code === 'clear') {
        await this.reset();
        this.setStatus('ready');
        return {
          id: request.id,
          success: true,
          resultLatex: '\\text{Session reset. Variables cleared.}',
          resultText: 'Session reset. Variables cleared.',
          resultType: 'text',
          executionTimeMs: performance.now() - startTime,
        };
      }

      // Variable assignment: `var := expr` or `var = expr`
      const assignMatch = code.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:=\s*(.+)$/);
      if (assignMatch) {
        const varName = assignMatch[1].trim();
        const rawExpr = assignMatch[2].trim();

        // Evaluate the assigned expression
        const parsed = this.parseExpression(rawExpr);
        const evaluated = parsed.evaluate();
        const valueLatex = evaluated.toLatex() || rawExpr;
        const valueText = evaluated.toString();

        // Assign into ComputeEngine
        this.ce.assign(varName, evaluated);

        const newVar: CasVariable = {
          name: varName,
          type: 'symbol',
          valueLatex,
          valueText,
          assignedAt: Date.now(),
        };

        this.scope[varName] = newVar;
        this.notifyScopeChange();
        this.setStatus('ready');

        return {
          id: request.id,
          success: true,
          resultLatex: `${varName} := ${valueLatex}`,
          resultText: `${varName} := ${valueText}`,
          resultType: 'equation',
          assignedVariables: [newVar],
          executionTimeMs: performance.now() - startTime,
        };
      }

      // Equation solving: solve(expr, var) or solve(lhs = rhs, var) or solve(lhs = rhs)
      const solveMatch = code.match(/^solve\s*\(\s*(.+?)(?:\s*,\s*([a-zA-Z_][a-zA-Z0-9_]*))?\s*\)$/);
      if (solveMatch) {
        const eqStr = solveMatch[1].trim();
        const solveVar = solveMatch[2]?.trim();
        const solveRes = this.handleSolve(eqStr, solveVar);
        this.setStatus('ready');
        return {
          id: request.id,
          success: true,
          resultLatex: solveRes.latex,
          resultText: solveRes.text,
          resultType: 'equation',
          executionTimeMs: performance.now() - startTime,
        };
      }

      // Standalone equation: lhs = rhs
      if (code.includes('=') && !code.includes(':=') && !/[<>!]/.test(code)) {
        const solveRes = this.handleSolve(code);
        this.setStatus('ready');
        return {
          id: request.id,
          success: true,
          resultLatex: solveRes.latex,
          resultText: solveRes.text,
          resultType: 'equation',
          executionTimeMs: performance.now() - startTime,
        };
      }

      // Explicit derivative: diff(expr, var) or \frac{d}{dx}(expr)
      const diffMatch = code.match(/^diff\s*\(\s*(.+?)\s*,\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)$/);
      if (diffMatch) {
        const innerExpr = diffMatch[1].trim();
        const diffVar = diffMatch[2].trim();
        const dBox = this.ce.box(['D', this.parseExpression(innerExpr), diffVar]);
        const evalRes = dBox.evaluate();
        const latex = evalRes.toLatex();
        this.setStatus('ready');
        return {
          id: request.id,
          success: true,
          resultLatex: latex,
          resultText: evalRes.toString(),
          resultType: 'expression',
          executionTimeMs: performance.now() - startTime,
        };
      }

      // Explicit integral: int(expr, var)
      const intMatch = code.match(/^int\s*\(\s*(.+?)\s*,\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)$/);
      if (intMatch) {
        const innerExpr = intMatch[1].trim();
        const intVar = intMatch[2].trim();
        const intBox = this.ce.box(['Integrate', this.parseExpression(innerExpr), intVar]);
        const evalRes = intBox.evaluate();
        let latex = evalRes.toLatex();
        if (latex && !latex.includes('+ C')) {
          latex = `${latex} + C`;
        }
        this.setStatus('ready');
        return {
          id: request.id,
          success: true,
          resultLatex: latex,
          resultText: evalRes.toString() + ' + C',
          resultType: 'expression',
          executionTimeMs: performance.now() - startTime,
        };
      }

      // General Expression Evaluation
      const expr = this.parseExpression(code);
      let evaluated = expr.evaluate();

      // If evaluating unchanged and simplify gives cleaner output, simplify
      if (evaluated.isSame(expr)) {
        const simplified = expr.simplify();
        if (!simplified.isSame(expr)) {
          evaluated = simplified;
        }
      }

      let latexOut = evaluated.toLatex();
      if (!latexOut || latexOut === 'undefined') {
        latexOut = expr.toLatex() || code;
      }

      this.setStatus('ready');
      return {
        id: request.id,
        success: true,
        resultLatex: latexOut,
        resultText: evaluated.toString() || code,
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
        error: err?.message || 'ComputeEngine evaluation error',
      };
    }
  }

  private parseExpression(code: string): any {
    // Check if input is LaTeX
    const isLatex = code.includes('\\') || code.includes('{') || code.includes('}');
    if (isLatex) {
      return this.ce.parse(code);
    }

    // Convert common standard math notation into clean parseable form
    let converted = code
      .replace(/\s*\*\s*/g, ' ') // ComputeEngine handles juxtaposition
      .replace(/\^/g, '^');

    return this.ce.parse(converted);
  }

  private handleSolve(equationStr: string, variable?: string): { latex: string; text: string } {
    try {
      let lhs: any;
      let rhs: any = 0;

      if (equationStr.includes('=')) {
        const parts = equationStr.split('=');
        lhs = this.parseExpression(parts[0]);
        rhs = this.parseExpression(parts[1]);
      } else {
        lhs = this.parseExpression(equationStr);
        rhs = 0;
      }

      const eqBox = this.ce.box(['Equal', lhs, rhs]);
      const targetVar = variable || (eqBox as any).unknowns?.[0] || 'x';
      const solutions: any = typeof (eqBox as any).solve === 'function' ? (eqBox as any).solve(targetVar) : null;

      if (Array.isArray(solutions) && solutions.length > 0) {
        const latexList = solutions.map((s: any) => `${targetVar} = ${typeof s?.toLatex === 'function' ? s.toLatex() : String(s)}`);
        const textList = solutions.map((s: any) => `${targetVar} = ${typeof s?.toString === 'function' ? s.toString() : String(s)}`);
        return {
          latex: `\\left\\{ ${latexList.join(', \\; ')} \\right\\}`,
          text: `{ ${textList.join(', ')} }`,
        };
      }

      return {
        latex: `\\text{No closed-form solution found for } ${targetVar}`,
        text: `No closed-form solution found for ${targetVar}`,
      };
    } catch {
      return {
        latex: `\\text{Solve error for } ${equationStr}`,
        text: `Solve error for ${equationStr}`,
      };
    }
  }

  public async interrupt(): Promise<void> {
    this.isInterrupted = true;
    this.setStatus('interrupted');
    setTimeout(() => this.setStatus('ready'), 200);
  }

  public async reset(): Promise<void> {
    this.ce = new ComputeEngine();
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
}
