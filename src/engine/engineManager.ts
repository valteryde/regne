import {
  ICasEngine,
  CasEngineMetadata,
  CasEvaluationRequest,
  CasEvaluationResult,
  CasVariable,
  EngineStatusListener,
  EngineScopeListener,
} from './types';
import { PythonSymPyBridge } from './pythonSympyBridge';

export type EngineChangeEvent = (activeEngine: CasEngineMetadata) => void;

/**
 * EngineManager
 * 
 * Central coordinator for CAS execution in Regne.
 * Regne is powered by Python SymPy — the definitive symbolic Computer Algebra System.
 */
export class EngineManager {
  private static instance: EngineManager;
  private engines: Map<string, ICasEngine> = new Map();
  private activeEngineId: string = 'python-sympy';
  
  private statusListeners: Set<EngineStatusListener> = new Set();
  private scopeListeners: Set<EngineScopeListener> = new Set();
  private engineChangeListeners: Set<EngineChangeEvent> = new Set();
  
  private activeStatusUnsub?: () => void;
  private activeScopeUnsub?: () => void;
  
  private isProcessingQueue: boolean = false;
  private evaluationQueue: Array<{
    request: CasEvaluationRequest;
    resolve: (val: CasEvaluationResult) => void;
    reject: (err: any) => void;
  }> = [];

  private constructor() {
    const sympy = new PythonSymPyBridge();
    this.registerEngine(sympy);
    this.activeEngineId = sympy.metadata.id;
  }

  public static getInstance(): EngineManager {
    if (!EngineManager.instance) {
      EngineManager.instance = new EngineManager();
    }
    return EngineManager.instance;
  }

  /**
   * Register a new CAS solver engine (e.g., Python SymPy, Giac WASM, Math.js)
   */
  public registerEngine(engine: ICasEngine): void {
    this.engines.set(engine.metadata.id, engine);
  }

  /**
   * Retrieve list of registered CAS engines
   */
  public getAvailableEngines(): CasEngineMetadata[] {
    return Array.from(this.engines.values()).map(e => e.metadata);
  }

  /**
   * Retrieve currently active CAS engine
   */
  public getActiveEngine(): ICasEngine {
    const engine = this.engines.get(this.activeEngineId);
    if (!engine) {
      throw new Error(`Engine ${this.activeEngineId} not found in registry.`);
    }
    return engine;
  }

  /**
   * Switch the active CAS engine
   */
  public async switchEngine(engineId: string): Promise<void> {
    const nextEngine = this.engines.get(engineId);
    if (!nextEngine) {
      throw new Error(`Engine with id '${engineId}' is not registered.`);
    }

    if (this.activeEngineId === engineId) return;

    // Detach old subscriptions
    if (this.activeStatusUnsub) this.activeStatusUnsub();
    if (this.activeScopeUnsub) this.activeScopeUnsub();

    this.activeEngineId = engineId;

    // Initialize next engine if needed
    if (nextEngine.metadata.status === 'uninitialized') {
      await nextEngine.initialize();
    }

    // Attach listeners
    this.attachActiveListeners();

    // Notify listeners
    for (const listener of this.engineChangeListeners) {
      listener(nextEngine.metadata);
    }
  }

  /**
   * Initialize default engine
   */
  public async initialize(): Promise<void> {
    const engine = this.getActiveEngine();
    await engine.initialize();
    this.attachActiveListeners();
  }

  private attachActiveListeners(): void {
    const engine = this.getActiveEngine();
    
    this.activeStatusUnsub = engine.onStatusChange((status, details) => {
      for (const listener of this.statusListeners) {
        listener(status, details);
      }
    });

    this.activeScopeUnsub = engine.onScopeChange((scope) => {
      for (const listener of this.scopeListeners) {
        listener(scope);
      }
    });
  }

  /**
   * Submit an expression/command for evaluation by the active engine.
   * Requests are queued to avoid race conditions.
   */
  public async evaluate(request: CasEvaluationRequest): Promise<CasEvaluationResult> {
    return new Promise((resolve, reject) => {
      this.evaluationQueue.push({ request, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.evaluationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const item = this.evaluationQueue.shift();

    if (!item) {
      this.isProcessingQueue = false;
      return;
    }

    try {
      const engine = this.getActiveEngine();
      const result = await engine.evaluate(item.request);
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    } finally {
      this.isProcessingQueue = false;
      this.processQueue();
    }
  }

  /**
   * Interrupt current evaluation (Maple's Stop button)
   */
  public async interrupt(): Promise<void> {
    // Clear pending queue items with cancelled results
    while (this.evaluationQueue.length > 0) {
      const item = this.evaluationQueue.shift();
      if (item) {
        item.resolve({
          id: item.request.id,
          success: false,
          resultType: 'error',
          executionTimeMs: 0,
          error: 'Execution cancelled before starting.',
        });
      }
    }

    const engine = this.getActiveEngine();
    await engine.interrupt();
  }

  /**
   * Reset the active engine's memory workspace (Maple's restart command)
   */
  public async reset(): Promise<void> {
    const engine = this.getActiveEngine();
    await engine.reset();
  }

  /**
   * Get variables in current scope
   */
  public async getScope(): Promise<Record<string, CasVariable>> {
    const engine = this.getActiveEngine();
    return await engine.getScope();
  }

  public onStatusChange(listener: EngineStatusListener): () => void {
    this.statusListeners.add(listener);
    const engine = this.getActiveEngine();
    listener(engine.metadata.status);
    return () => this.statusListeners.delete(listener);
  }

  public onScopeChange(listener: EngineScopeListener): () => void {
    this.scopeListeners.add(listener);
    this.getActiveEngine().getScope().then(scope => listener(scope));
    return () => this.scopeListeners.delete(listener);
  }

  public onEngineChange(listener: EngineChangeEvent): () => void {
    this.engineChangeListeners.add(listener);
    listener(this.getActiveEngine().metadata);
    return () => this.engineChangeListeners.delete(listener);
  }
}
