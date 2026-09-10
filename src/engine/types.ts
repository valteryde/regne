/**
 * Core CAS (Computer Algebra System) Engine Architecture Definitions
 * 
 * Defines the abstraction contracts for mathematical solvers.
 * Any future CAS engine (e.g. SymPy, Giac, Math.js, or custom WebAssembly/C++ solver)
 * implements the `ICasEngine` interface.
 */

export type CasResultType = 
  | 'expression' 
  | 'equation' 
  | 'matrix' 
  | 'text' 
  | 'error' 
  | 'void';

export interface CasVariable {
  name: string;
  type: string; // e.g., 'symbol', 'function', 'matrix', 'constant', 'expression'
  valueLatex: string;
  valueText: string;
  assignedAt?: number;
}

export interface CasEvaluationRequest {
  id: string;
  code: string;
  mode?: 'math' | 'command';
  timeoutMs?: number;
}

export interface CasEvaluationResult {
  id: string;
  success: boolean;
  resultLatex?: string;
  resultText?: string;
  resultType: CasResultType;
  consoleOutput?: string;
  assignedVariables?: CasVariable[];
  executionTimeMs: number;
  error?: string;
}

export interface CasEngineCapabilities {
  symbolicMath: boolean;
  numericEval: boolean;
  calculus: boolean;
  linearAlgebra: boolean;
  arbitraryPrecision: boolean;
  customFunctions: boolean;
}

export interface CasEngineMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  backend: 'javascript' | 'python' | 'wasm' | 'native' | 'remote';
  capabilities: CasEngineCapabilities;
  status: 'uninitialized' | 'ready' | 'busy' | 'interrupted' | 'error' | 'terminated';
}

export type EngineStatusListener = (status: CasEngineMetadata['status'], details?: string) => void;
export type EngineScopeListener = (variables: Record<string, CasVariable>) => void;

export interface ICasEngine {
  readonly metadata: CasEngineMetadata;
  
  /** Initialize the engine runtime */
  initialize(): Promise<void>;
  
  /** Evaluate an expression or command */
  evaluate(request: CasEvaluationRequest): Promise<CasEvaluationResult>;
  
  /** Interrupt current evaluation job */
  interrupt(): Promise<void>;
  
  /** Reset engine workspace (clears variables, functions, assumptions) */
  reset(): Promise<void>;
  
  /** Retrieve all currently defined variables and functions in scope */
  getScope(): Promise<Record<string, CasVariable>>;
  
  /** Terminate and clean up resources */
  terminate(): Promise<void>;
  
  /** Subscribe to status transitions */
  onStatusChange(listener: EngineStatusListener): () => void;
  
  /** Subscribe to scope/variable changes */
  onScopeChange(listener: EngineScopeListener): () => void;
}
