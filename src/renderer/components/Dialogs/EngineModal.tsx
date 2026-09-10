import React from 'react';
import { useEngine } from '../../context/EngineContext';
import { X, Cpu, Check, ExternalLink, Code, Layers } from 'lucide-react';

interface EngineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EngineModal: React.FC<EngineModalProps> = ({ isOpen, onClose }) => {
  const { availableEngines, activeEngine, switchEngine } = useEngine();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full border border-stone-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 bg-stone-100 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-bold text-stone-800">
              CAS Engine Architecture & Solvers
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-stone-200 rounded text-stone-500 hover:text-stone-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Available Engines Section */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              Available CAS Solvers
            </h3>
            <div className="space-y-3">
              {availableEngines.map((eng) => {
                const isActive = eng.id === activeEngine.id;
                return (
                  <div
                    key={eng.id}
                    onClick={() => switchEngine(eng.id)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      isActive
                        ? 'border-red-500 bg-red-50/40 ring-1 ring-red-400'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-stone-900 flex items-center gap-2">
                          <span>{eng.name}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-stone-100 border border-stone-200 text-stone-600 rounded font-mono">
                            v{eng.version}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 bg-stone-100 border border-stone-200 text-stone-600 rounded capitalize">
                            {eng.backend}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-1">{eng.description}</p>
                      </div>
                      {isActive && (
                        <div className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                          <Check className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </div>
                      )}
                    </div>

                    {/* Capabilities Tags */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(eng.capabilities).map(([cap, enabled]) => (
                        <span
                          key={cap}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            enabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-stone-50 text-stone-400 line-through'
                          }`}
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Integration Guide Section */}
          <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Code className="w-4 h-4 text-blue-600" />
              How to Plug In Your Own CAS Solver
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Regne is engineered with a completely pluggable solver pipeline. To attach an external solver (like Python SymPy, Giac WASM, Maxima, or a custom C++ engine):
            </p>
            <ol className="text-xs text-stone-600 list-decimal list-inside space-y-1.5 pl-1 font-mono">
              <li>Implement <span className="text-red-700 font-bold">ICasEngine</span> in <span className="text-stone-800">src/engine/types.ts</span></li>
              <li>Provide <span className="text-stone-800">evaluate(request)</span> returning LaTeX and result types</li>
              <li>Register in <span className="text-stone-800">EngineManager.getInstance().registerEngine(mySolver)</span></li>
            </ol>
            <div className="text-[11px] text-stone-500 italic mt-2">
              See <span className="font-mono text-stone-700">src/engine/README.md</span> and <span className="font-mono text-stone-700">src/engine/pythonSympyBridge.ts</span> for complete templates.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-stone-100 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
