import React from 'react';
import { useDocument } from '../../context/DocumentContext';

interface GreekLetter {
  char: string;
  latex: string;
}

const greekLetters: GreekLetter[] = [
  { char: 'α', latex: '\\alpha ' },
  { char: 'β', latex: '\\beta ' },
  { char: 'γ', latex: '\\gamma ' },
  { char: 'δ', latex: '\\delta ' },
  { char: 'ε', latex: '\\epsilon ' },
  { char: 'θ', latex: '\\theta ' },
  { char: 'λ', latex: '\\lambda ' },
  { char: 'μ', latex: '\\mu ' },
  { char: 'π', latex: '\\pi ' },
  { char: 'ρ', latex: '\\rho ' },
  { char: 'σ', latex: '\\sigma ' },
  { char: 'τ', latex: '\\tau ' },
  { char: 'φ', latex: '\\phi ' },
  { char: 'ψ', latex: '\\psi ' },
  { char: 'ω', latex: '\\omega ' },
  { char: 'Γ', latex: '\\Gamma ' },
  { char: 'Δ', latex: '\\Delta ' },
  { char: 'Θ', latex: '\\Theta ' },
  { char: 'Λ', latex: '\\Lambda ' },
  { char: 'Σ', latex: '\\Sigma ' },
  { char: 'Φ', latex: '\\Phi ' },
  { char: 'Ψ', latex: '\\Psi ' },
  { char: 'Ω', latex: '\\Omega ' },
];

export function filterGreek(query: string): GreekLetter[] {
  const q = query.trim().toLowerCase();
  if (!q) return greekLetters;
  return greekLetters.filter((g) => g.char.includes(q) || g.latex.toLowerCase().includes(q));
}

export const GreekPalette: React.FC<{ query?: string }> = ({ query = '' }) => {
  const { insertAtCursor } = useDocument();
  const letters = filterGreek(query);
  if (query.trim() && letters.length === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-1 p-2 bg-[var(--bg-surface)]">
      {letters.map((g) => (
        <button
          key={g.latex}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertAtCursor(g.latex)}
          className="h-7 flex items-center justify-center bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] text-sm font-serif rounded-xs border border-[var(--border-color)] hover:border-[#242e84]/50 transition-colors select-none"
          title={g.latex.trim()}
        >
          {g.char}
        </button>
      ))}
    </div>
  );
};
