import React from 'react';
import { useDocument } from '../../context/DocumentContext';

interface SymbolItem {
  label: string;
  snippet: string;
  tooltip: string;
}

const symbols: SymbolItem[] = [
  { label: 'π', snippet: '\\pi ', tooltip: 'Pi' },
  { label: 'e', snippet: 'e', tooltip: 'Euler number' },
  { label: '∞', snippet: '\\infty ', tooltip: 'Infinity' },
  { label: '√x', snippet: '\\sqrt{#?}', tooltip: 'Square root' },
  { label: 'xⁿ', snippet: '#?^{#?}', tooltip: 'Power' },
  { label: 'a/b', snippet: '\\frac{#?}{#?}', tooltip: 'Fraction' },
  { label: '±', snippet: '\\pm ', tooltip: 'Plus-minus' },
  { label: '≠', snippet: '\\neq ', tooltip: 'Not equal' },
  { label: '≤', snippet: '\\leq ', tooltip: 'Less than or equal' },
  { label: '≥', snippet: '\\geq ', tooltip: 'Greater than or equal' },
  { label: '·', snippet: '\\cdot ', tooltip: 'Multiplication dot' },
  { label: ':=', snippet: ' := ', tooltip: 'Assignment' },
  { label: '|x|', snippet: '\\left|#?\\right|', tooltip: 'Absolute value' },
  { label: '→', snippet: '\\to ', tooltip: 'Arrow' },
  { label: 'sin', snippet: '\\sin\\left(#?\\right)', tooltip: 'Sine' },
  { label: 'cos', snippet: '\\cos\\left(#?\\right)', tooltip: 'Cosine' },
];

export function filterCommonSymbols(query: string): SymbolItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return symbols;
  return symbols.filter((item) =>
    item.label.toLowerCase().includes(q) ||
    item.tooltip.toLowerCase().includes(q) ||
    item.snippet.toLowerCase().includes(q)
  );
}

export const CommonSymbols: React.FC<{ query?: string }> = ({ query = '' }) => {
  const { insertAtCursor } = useDocument();
  const items = filterCommonSymbols(query);
  if (query.trim() && items.length === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-1 p-2 bg-[var(--bg-surface)]">
      {items.map((item) => (
        <button
          key={item.snippet}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertAtCursor(item.snippet)}
          className="h-7 flex items-center justify-center bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] text-sm font-serif rounded-xs border border-[var(--border-color)] hover:border-[#242e84]/50 transition-colors select-none"
          title={item.tooltip}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};
