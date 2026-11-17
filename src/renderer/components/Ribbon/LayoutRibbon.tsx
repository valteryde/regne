import React from 'react';
import { useDocument } from '../../context/DocumentContext';
import { Ruler, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export const LayoutRibbon: React.FC = () => {
  const {
    isRulerVisible,
    toggleRuler,
    rulerPosition,
    setRulerPosition,
    zoom,
    setZoom,
  } = useDocument();

  return (
    <div className="ribbon-row px-2 select-none text-slate-700 bg-white">
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleRuler}
            className={`h-7 px-2 flex items-center gap-1 text-xs font-semibold rounded border transition-colors cursor-pointer ${
              isRulerVisible
                ? 'bg-[#242e84] text-white border-[#242e84]'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="Show or hide the margin ruler"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>{isRulerVisible ? 'Hide ruler' : 'Show ruler'}</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setRulerPosition(rulerPosition === 'top' ? 'bottom' : 'top')}
            className="h-7 px-2 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 cursor-pointer"
            title="Move the ruler above or below the page"
          >
            {rulerPosition === 'top' ? 'Dock bottom' : 'Dock top'}
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Ruler
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(1))))}
            className="h-7 w-7 flex items-center justify-center hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-xs font-semibold text-slate-700 px-1 select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setZoom((prev) => Math.min(2.0, Number((prev + 0.1).toFixed(1))))}
            className="h-7 w-7 flex items-center justify-center hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setZoom(1.0)}
            className="h-7 px-1.5 flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="Reset to 100%"
          >
            <RotateCcw className="w-3 h-3" />
            <span>100%</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Scale
        </div>
      </div>
    </div>
  );
};
