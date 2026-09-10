import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { EngineManager } from '../../engine/engineManager';
import {
  CasEngineMetadata,
  CasEvaluationResult,
  CasVariable,
} from '../../engine/types';
import { PythonSymPyBridge } from '../../engine/pythonSympyBridge';

interface EngineContextValue {
  activeEngine: CasEngineMetadata;
  availableEngines: CasEngineMetadata[];
  status: CasEngineMetadata['status'];
  variables: Record<string, CasVariable>;
  evaluate: (code: string, cellId?: string) => Promise<CasEvaluationResult>;
  interrupt: () => Promise<void>;
  reset: () => Promise<void>;
  switchEngine: (engineId: string) => Promise<void>;
}

const EngineContext = createContext<EngineContextValue | null>(null);

export const EngineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const manager = EngineManager.getInstance();

  const [activeEngine, setActiveEngine] = useState<CasEngineMetadata>(manager.getActiveEngine().metadata);
  const [availableEngines, setAvailableEngines] = useState<CasEngineMetadata[]>(manager.getAvailableEngines());
  const [status, setStatus] = useState<CasEngineMetadata['status']>(activeEngine.status);
  const [variables, setVariables] = useState<Record<string, CasVariable>>({});

  useEffect(() => {
    // Initialize engine on startup
    manager.initialize().then(() => {
      setAvailableEngines(manager.getAvailableEngines());
      setActiveEngine({ ...manager.getActiveEngine().metadata });
    });

    const unsubStatus = manager.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    const unsubScope = manager.onScopeChange((newScope) => {
      setVariables(newScope);
    });

    const unsubEngine = manager.onEngineChange((engineMeta) => {
      setActiveEngine({ ...engineMeta });
      setAvailableEngines(manager.getAvailableEngines());
    });

    return () => {
      unsubStatus();
      unsubScope();
      unsubEngine();
    };
  }, [manager]);

  const evaluate = useCallback(
    async (code: string): Promise<CasEvaluationResult> => {
      return await manager.evaluate({
        id: 'eval-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        code,
      });
    },
    [manager]
  );

  const interrupt = useCallback(async () => {
    await manager.interrupt();
  }, [manager]);

  const reset = useCallback(async () => {
    await manager.reset();
  }, [manager]);

  const switchEngine = useCallback(
    async (engineId: string) => {
      await manager.switchEngine(engineId);
    },
    [manager]
  );

  return (
    <EngineContext.Provider
      value={{
        activeEngine,
        availableEngines,
        status,
        variables,
        evaluate,
        interrupt,
        reset,
        switchEngine,
      }}
    >
      {children}
    </EngineContext.Provider>
  );
};

export const useEngine = () => {
  const context = useContext(EngineContext);
  if (!context) {
    throw new Error('useEngine must be used within an EngineProvider');
  }
  return context;
};
