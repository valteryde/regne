import {
  ICasEngine,
  CasEngineMetadata,
  CasEvaluationRequest,
  CasEvaluationResult,
  CasVariable,
  EngineStatusListener,
  EngineScopeListener,
} from './types';

declare const window: any;

/**
 * PythonSymPyBridge
 * 
 * Production adapter bridging Regne to an external Python + SymPy process
 * over Electron IPC (or direct child process when in Node).
 */
export class PythonSymPyBridge implements ICasEngine {
  public readonly metadata: CasEngineMetadata = {
    id: 'python-sympy',
    name: 'Python SymPy Engine (External CAS)',
    version: '1.13.0',
    description: 'Full symbolic CAS powered by Python and SymPy',
    backend: 'python',
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

  private scope: Record<string, CasVariable> = {};
  private statusListeners: Set<EngineStatusListener> = new Set();
  private scopeListeners: Set<EngineScopeListener> = new Set();
  private lastErrorMessage: string | null = null;

  public async initialize(): Promise<void> {
    const api = this.getApi();
    if (api?.casSympy) {
      try {
        const status = await api.casSympy.getStatus();
        if (status.ready) {
          if (status.version) {
            this.metadata.version = status.version;
          }
          this.lastErrorMessage = null;
          this.setStatus('ready');
        } else if (status.error) {
          this.lastErrorMessage = status.error;
          this.setStatus('error');
        } else {
          this.setStatus('ready');
        }
      } catch (err: any) {
        this.lastErrorMessage = err?.message || 'Failed to connect to SymPy worker';
        this.setStatus('error');
      }
    } else if (typeof window === 'undefined') {
      // Running under Node.js (e.g. tests)
      this.setStatus('ready');
    } else {
      // Running in standard browser without Electron
      this.lastErrorMessage = 'SymPy requires Electron desktop mode. Start app with: npm start';
      this.setStatus('error');
    }
  }

  public async evaluate(request: CasEvaluationRequest): Promise<CasEvaluationResult> {
    const startTime = performance.now();
    this.setStatus('busy');

    const api = this.getApi();

    if (api?.casSympy) {
      try {
        const result = await api.casSympy.evaluate(request.id, request.code);
        this.setStatus('ready');

        if (result.assignedVariables && Array.isArray(result.assignedVariables)) {
          for (const v of result.assignedVariables) {
            this.scope[v.name] = v;
          }
          this.notifyScopeChange();
        }

        if (!result.success) {
          if (result.error && (result.error.toLowerCase().includes('sympy') || result.error.toLowerCase().includes('not installed'))) {
            this.setStatus('error');
          }
          return {
            id: request.id,
            success: false,
            resultLatex: result.resultLatex || `\\text{\\color{red}{${result.error || 'SymPy evaluation failed'}}}`,
            resultText: result.resultText || result.error || 'SymPy evaluation failed',
            resultType: 'error',
            executionTimeMs: result.executionTimeMs || (performance.now() - startTime),
            error: result.error,
          };
        }

        return {
          id: request.id,
          success: result.success,
          resultLatex: result.resultLatex,
          resultText: result.resultText,
          resultType: result.resultType || (result.success ? 'expression' : 'error'),
          plotSvg: result.plotSvg,
          executionTimeMs: result.executionTimeMs || (performance.now() - startTime),
          assignedVariables: result.assignedVariables,
          error: result.error,
        };
      } catch (err: any) {
        this.setStatus('error');
        return {
          id: request.id,
          success: false,
          resultLatex: `\\text{\\color{red}{Error: ${err?.message || 'SymPy evaluation failed'}}}`,
          resultText: err?.message || 'SymPy evaluation failed',
          resultType: 'error',
          executionTimeMs: performance.now() - startTime,
          error: err?.message,
        };
      }
    }

    // Fallback if not in Electron window
    this.setStatus('error');
    const msg = this.lastErrorMessage || 'SymPy requires Electron desktop environment (npm start).';
    return {
      id: request.id,
      success: false,
      resultLatex: `\\text{\\color{red}{${msg}}}`,
      resultText: msg,
      resultType: 'error',
      executionTimeMs: performance.now() - startTime,
      error: msg,
    };
  }

  public async interrupt(): Promise<void> {
    const api = this.getApi();
    if (api?.casSympy) {
      api.casSympy.interrupt();
    }
    this.setStatus('interrupted');
    setTimeout(() => this.setStatus('ready'), 200);
  }

  public async reset(): Promise<void> {
    const api = this.getApi();
    if (api?.casSympy) {
      await api.casSympy.reset();
    }
    this.scope = {};
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
    listener(this.metadata.status, this.lastErrorMessage || undefined);
    return () => this.statusListeners.delete(listener);
  }

  public onScopeChange(listener: EngineScopeListener): () => void {
    this.scopeListeners.add(listener);
    listener(this.scope);
    return () => this.scopeListeners.delete(listener);
  }

  private getApi(): any {
    if (typeof window !== 'undefined') {
      return (window as any).regneAPI || (window as any).hypatiaAPI;
    }
    return null;
  }

  private setStatus(status: CasEngineMetadata['status']): void {
    this.metadata.status = status;
    for (const l of this.statusListeners) l(status, this.lastErrorMessage || undefined);
  }

  private notifyScopeChange(): void {
    for (const l of this.scopeListeners) l(this.scope);
  }
}
