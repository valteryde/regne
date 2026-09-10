import React from 'react';
import { useDocument } from '../../context/DocumentContext';

interface CalcTemplate {
  name: string;
  snippet: string;
  display: string;
}

const templates: CalcTemplate[] = [
  {
    name: 'Fraction',
    snippet: '\\frac{#?}{#?}',
    display: 'a/b',
  },
  {
    name: 'Power',
    snippet: '#?^{#?}',
    display: 'xⁿ',
  },
  {
    name: 'Square Root',
    snippet: '\\sqrt{#?}',
    display: '√x',
  },
  {
    name: 'Derivative',
    snippet: '\\frac{d}{dx}\\left(#?\\right)',
    display: 'd/dx f',
  },
  {
    name: 'Second Derivative',
    snippet: '\\frac{d^{2}}{dx^{2}}\\left(#?\\right)',
    display: 'd²/dx² f',
  },
  {
    name: 'Indefinite Integral',
    snippet: '\\int #?\\, dx',
    display: '∫ f dx',
  },
  {
    name: 'Definite Integral',
    snippet: '\\int_{#?}^{#?} #?\\, dx',
    display: '∫ₐᵇ f dx',
  },
  {
    name: 'Summation',
    snippet: '\\sum_{i=#?}^{#?} #?',
    display: '∑ᵢ f(i)',
  },
  {
    name: 'Limit',
    snippet: '\\lim_{x \\to #?} #?',
    display: 'limₓ→ₐ f',
  },
];

export const CalculusPalette: React.FC = () => {
  const { insertAtCursor } = useDocument();

  return (
    <div className="grid grid-cols-2 gap-1.5 p-2 bg-[var(--bg-surface)]">
      {templates.map((tpl, idx) => (
        <button
          key={idx}
          onClick={() => insertAtCursor(tpl.snippet)}
          className="h-7 px-2 flex items-center justify-center bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] text-xs font-serif rounded-xs border border-[var(--border-color)] hover:border-[#242e84]/50 transition-colors truncate select-none"
          title={`Insert ${tpl.name}`}
        >
          {tpl.display}
        </button>
      ))}
    </div>
  );
};
