import React from 'react';
import { useDocument } from '../../context/DocumentContext';
import { PanelLeft } from 'lucide-react';

interface SymbolsRibbonProps {
  onTogglePalettes: () => void;
  isPalettesOpen: boolean;
}

export const SymbolsRibbon: React.FC<SymbolsRibbonProps> = ({
  onTogglePalettes,
  isPalettesOpen,
}) => {
  const { insertAtCursor } = useDocument();

  const relations = [
    { label: '≤', latex: '\\leq ' },
    { label: '≥', latex: '\\geq ' },
    { label: '≠', latex: '\\neq ' },
    { label: '±', latex: '\\pm ' },
    { label: '≈', latex: '\\approx ' },
    { label: '≡', latex: '\\equiv ' },
    { label: '·', latex: '\\cdot ' },
  ];

  const sets = [
    { label: 'ℝ', latex: '\\mathbb{R}' },
    { label: 'ℂ', latex: '\\mathbb{C}' },
    { label: 'ℕ', latex: '\\mathbb{N}' },
    { label: 'ℤ', latex: '\\mathbb{Z}' },
    { label: '∈', latex: '\\in ' },
    { label: '∉', latex: '\\notin ' },
    { label: '⊂', latex: '\\subset ' },
    { label: '∪', latex: '\\cup ' },
    { label: '∩', latex: '\\cap ' },
  ];

  const logic = [
    { label: '∀', latex: '\\forall ' },
    { label: '∃', latex: '\\exists ' },
    { label: '¬', latex: '\\neg ' },
    { label: '∧', latex: '\\land ' },
    { label: '∨', latex: '\\lor ' },
  ];

  return (
    <div className="flex items-stretch h-14 px-2 select-none overflow-visible text-slate-700 bg-white">
      {/* 1. RELATIONS */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          {relations.map((rel, idx) => (
            <button
              key={idx}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertAtCursor(rel.latex)}
              className="h-7 w-6 flex items-center justify-center font-serif text-sm hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
              title={`Insert ${rel.label}`}
            >
              <span>{rel.label}</span>
            </button>
          ))}
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Relations
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* 2. SET THEORY */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          {sets.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertAtCursor(s.latex)}
              className="h-7 w-6 flex items-center justify-center font-serif text-sm hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
              title={`Insert ${s.label}`}
            >
              <span>{s.label}</span>
            </button>
          ))}
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Sets & Structures
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* 3. LOGIC */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          {logic.map((l, idx) => (
            <button
              key={idx}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertAtCursor(l.latex)}
              className="h-7 w-6 flex items-center justify-center font-serif text-sm hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
              title={`Insert ${l.label}`}
            >
              <span>{l.label}</span>
            </button>
          ))}
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Logic
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* 4. SIDE PALETTES DRAWER TOGGLE */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center justify-center flex-1">
          <button
            type="button"
            onClick={onTogglePalettes}
            className={`h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer ${
              isPalettesOpen
                ? 'bg-slate-100 text-slate-900 border border-slate-300'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
            title="Toggle Sidebar Palettes Drawer"
          >
            <PanelLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>{isPalettesOpen ? 'Close Drawer' : 'Open Drawer'}</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Sidebar
        </div>
      </div>
    </div>
  );
};
