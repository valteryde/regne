import React from 'react';
import { useDocument } from '../../context/DocumentContext';
import { useEngine } from '../../context/EngineContext';
import {
  Play,
  FastForward,
  RotateCcw,
  CheckCircle2,
  X,
  Eraser,
} from 'lucide-react';

export const ReviewRibbon: React.FC = () => {
  const {
    document: doc,
    activeElementId,
    evaluateMath,
    evaluateAll,
    unevaluateMath,
    unevaluateAll,
  } = useDocument();

  const { reset } = useEngine();

  const mathElements = doc.elements.filter((el) => el.type === 'math');
  const evaluatedCount = mathElements.filter((el) => el.evaluated).length;
  const isAnyEvaluating = mathElements.some((el) => el.isEvaluating);

  const activeElement = activeElementId
    ? doc.elements.find((el) => el.id === activeElementId)
    : null;
  const activeIsMathAndEvaluated =
    activeElement?.type === 'math' && activeElement.evaluated;

  const handleEvaluateActive = () => {
    if (activeElementId) {
      evaluateMath(activeElementId);
    }
  };

  const handleClearResult = () => {
    if (activeElementId) {
      unevaluateMath(activeElementId);
    }
  };

  return (
    <div className="flex items-stretch h-14 px-2 select-none overflow-visible text-slate-700 bg-white">
      {/* 1. EVALUATION & SOLVER */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1.5 justify-center flex-1">
          <button
            type="button"
            onClick={handleEvaluateActive}
            disabled={!activeElementId || isAnyEvaluating}
            className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold bg-[#242e84] text-white hover:bg-[#1a226b] disabled:opacity-50 rounded-[2px] transition-colors cursor-pointer shadow-2xs"
            title="Evaluate currently selected math expression (Enter)"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Evaluate (Enter)</span>
          </button>
          <button
            type="button"
            onClick={evaluateAll}
            disabled={isAnyEvaluating || mathElements.length === 0}
            className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-50 rounded-[2px] border border-slate-200 transition-colors cursor-pointer"
            title="Evaluate entire document top-to-bottom"
          >
            <FastForward className="w-3.5 h-3.5 text-slate-500" />
            <span>Evaluate All</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          CAS Solver
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* 2. CLEAR RESULTS */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1.5 justify-center flex-1">
          <button
            type="button"
            onClick={handleClearResult}
            disabled={!activeIsMathAndEvaluated || isAnyEvaluating}
            className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-50 rounded-[2px] border border-slate-200 transition-colors cursor-pointer"
            title="Clear result of the selected math expression"
          >
            <X className="w-3.5 h-3.5 text-slate-500" />
            <span>Clear Result</span>
          </button>
          <button
            type="button"
            onClick={unevaluateAll}
            disabled={evaluatedCount === 0 || isAnyEvaluating}
            className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-50 rounded-[2px] border border-slate-200 transition-colors cursor-pointer"
            title="Clear all evaluated results in the document"
          >
            <Eraser className="w-3.5 h-3.5 text-slate-500" />
            <span>Clear All Results</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Clear Results
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* 3. RESTART ENGINE */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center justify-center flex-1">
          <button
            type="button"
            onClick={reset}
            className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-[2px] border border-slate-200 transition-colors cursor-pointer"
            title="Clear all symbolic variables & restart SymPy engine (restart;)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Restart Session</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Engine State
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* 4. DOCUMENT STATUS */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-2 justify-center flex-1 text-xs font-mono text-slate-600">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {evaluatedCount} / {mathElements.length} Evaluated
            </span>
          </div>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Document Audit
        </div>
      </div>
    </div>
  );
};

