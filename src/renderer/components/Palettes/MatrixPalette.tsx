import React, { useState } from 'react';
import { useDocument } from '../../context/DocumentContext';

export const MatrixPalette: React.FC = () => {
  const { insertAtCursor } = useDocument();
  const [rows, setRows] = useState<number>(2);
  const [cols, setCols] = useState<number>(2);

  const insertCustomMatrix = () => {
    const matrixRows: string[] = [];
    for (let r = 0; r < rows; r++) {
      const rowCells: string[] = [];
      for (let c = 0; c < cols; c++) {
        rowCells.push('#?');
      }
      matrixRows.push(rowCells.join(' & '));
    }
    const snippet = `\\begin{pmatrix} ${matrixRows.join(' \\\\ ')} \\end{pmatrix}`;
    insertAtCursor(snippet);
  };

  return (
    <div className="p-2 space-y-2 text-xs bg-[var(--bg-surface)]">
      <div className="bg-[var(--bg-subtle)] p-2 rounded border border-[var(--border-color)] space-y-1.5">
        <div className="font-semibold text-[var(--text-primary)]">2D Matrix Template</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[var(--text-secondary)]">Rows:</span>
            <input
              type="number"
              min={1}
              max={6}
              value={rows}
              onChange={(e) => setRows(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
              className="w-10 px-1 py-0.5 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-center font-mono"
            />
          </div>
          <span className="text-[var(--text-muted)]">×</span>
          <div className="flex items-center gap-1">
            <span className="text-[var(--text-secondary)]">Cols:</span>
            <input
              type="number"
              min={1}
              max={6}
              value={cols}
              onChange={(e) => setCols(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
              className="w-10 px-1 py-0.5 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-center font-mono"
            />
          </div>
        </div>
        <button
          onClick={insertCustomMatrix}
          className="w-full py-1 bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-primary)] font-mono text-xs uppercase tracking-wider font-bold border border-[var(--border-color)] transition-colors text-center"
        >
          Insert {rows}×{cols} Matrix
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 font-mono text-xs">
        <button
          onClick={() => insertAtCursor('\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}')}
          className="p-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] text-center transition-colors font-mono"
          title="2x2 Identity Matrix"
        >
          I₂ (2×2)
        </button>
        <button
          onClick={() => insertAtCursor('\\begin{pmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{pmatrix}')}
          className="p-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] text-center transition-colors font-mono"
          title="3x3 Identity Matrix"
        >
          I₃ (3×3)
        </button>
      </div>
    </div>
  );
};
