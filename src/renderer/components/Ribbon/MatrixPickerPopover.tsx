import React, { useState, useRef, useEffect } from 'react';
import { useDocument } from '../../context/DocumentContext';
import { Grid3X3 } from 'lucide-react';

interface MatrixPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export const MatrixPickerPopover: React.FC<MatrixPickerPopoverProps> = ({
  isOpen,
  onClose,
  anchorRef,
}) => {
  const { insertMatrix, insertAtCursor } = useDocument();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [hoverRow, setHoverRow] = useState<number>(3);
  const [hoverCol, setHoverCol] = useState<number>(3);
  const [bracketType, setBracketType] = useState<'pmatrix' | 'bmatrix' | 'vmatrix'>('pmatrix');

  const maxRows = 6;
  const maxCols = 6;

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        (!anchorRef?.current || !anchorRef.current.contains(e.target as Node))
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const handleSelectGrid = (r: number, c: number) => {
    insertMatrix(r, c, bracketType);
    onClose();
  };

  const handleInsertIdentity = (size: number) => {
    const rows: string[] = [];
    for (let i = 0; i < size; i++) {
      const rowCells: string[] = [];
      for (let j = 0; j < size; j++) {
        rowCells.push(i === j ? '1' : '0');
      }
      rows.push(rowCells.join(' & '));
    }
    const snippet = `\\begin{${bracketType}} ${rows.join(' \\\\ ')} \\end{${bracketType}}`;
    insertAtCursor(snippet);
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-1 z-50 bg-white rounded-md shadow-xl border border-slate-200 p-3 w-64 text-slate-800 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs font-semibold text-slate-700">
        <div className="flex items-center gap-1.5">
          <Grid3X3 className="w-3.5 h-3.5 text-[#242e84]" />
          <span>Insert Matrix</span>
        </div>
        <span className="text-[11px] font-mono font-medium text-slate-500">
          {hoverRow} × {hoverCol}
        </span>
      </div>

      {/* Bracket Style Chooser */}
      <div className="mb-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Bracket Style
        </div>
        <div className="grid grid-cols-3 gap-1 text-xs">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setBracketType('pmatrix')}
            className={`py-1 px-1.5 rounded border text-center font-serif text-[11px] transition-colors ${
              bracketType === 'pmatrix'
                ? 'bg-[#242e84] text-white border-[#242e84]'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            ( A ) Round
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setBracketType('bmatrix')}
            className={`py-1 px-1.5 rounded border text-center font-serif text-[11px] transition-colors ${
              bracketType === 'bmatrix'
                ? 'bg-[#242e84] text-white border-[#242e84]'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            [ A ] Square
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setBracketType('vmatrix')}
            className={`py-1 px-1.5 rounded border text-center font-serif text-[11px] transition-colors ${
              bracketType === 'vmatrix'
                ? 'bg-[#242e84] text-white border-[#242e84]'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            | A | Det
          </button>
        </div>
      </div>

      {/* Interactive Grid Selector */}
      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          Dimension Grid
        </div>
        <div
          className="inline-grid gap-1 p-1.5 bg-slate-50 rounded border border-slate-200"
          style={{ gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: maxRows }).map((_, rIdx) =>
            Array.from({ length: maxCols }).map((_, cIdx) => {
              const r = rIdx + 1;
              const c = cIdx + 1;
              const isHighlighted = r <= hoverRow && c <= hoverCol;
              return (
                <div
                  key={`${r}-${c}`}
                  onMouseEnter={() => {
                    setHoverRow(r);
                    setHoverCol(c);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectGrid(r, c)}
                  className={`w-6 h-6 rounded-xs border cursor-pointer transition-colors flex items-center justify-center text-[10px] font-mono ${
                    isHighlighted
                      ? 'bg-[#242e84]/20 border-[#242e84] text-[#242e84] font-semibold'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  }`}
                  title={`${r} × ${c} Matrix`}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Quick Presets */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Identity & Common
        </div>
        <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertIdentity(2)}
            className="py-1 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors text-left flex items-center justify-between"
          >
            <span>2×2 Identity</span>
            <span className="text-slate-400 text-[10px]">I₂</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertIdentity(3)}
            className="py-1 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors text-left flex items-center justify-between"
          >
            <span>3×3 Identity</span>
            <span className="text-slate-400 text-[10px]">I₃</span>
          </button>
        </div>
      </div>
    </div>
  );
};
