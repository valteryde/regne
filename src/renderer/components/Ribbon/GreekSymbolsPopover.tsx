import React, { useRef, useEffect, useState } from 'react';
import { useDocument } from '../../context/DocumentContext';
import { Pi } from 'lucide-react';

interface GreekSymbolsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const lowercaseGreek = [
  { char: 'α', latex: '\\alpha ', name: 'alpha' },
  { char: 'β', latex: '\\beta ', name: 'beta' },
  { char: 'γ', latex: '\\gamma ', name: 'gamma' },
  { char: 'δ', latex: '\\delta ', name: 'delta' },
  { char: 'ε', latex: '\\epsilon ', name: 'epsilon' },
  { char: 'ζ', latex: '\\zeta ', name: 'zeta' },
  { char: 'η', latex: '\\eta ', name: 'eta' },
  { char: 'θ', latex: '\\theta ', name: 'theta' },
  { char: 'ι', latex: '\\iota ', name: 'iota' },
  { char: 'κ', latex: '\\kappa ', name: 'kappa' },
  { char: 'λ', latex: '\\lambda ', name: 'lambda' },
  { char: 'μ', latex: '\\mu ', name: 'mu' },
  { char: 'ν', latex: '\\nu ', name: 'nu' },
  { char: 'ξ', latex: '\\xi ', name: 'xi' },
  { char: 'π', latex: '\\pi ', name: 'pi' },
  { char: 'ρ', latex: '\\rho ', name: 'rho' },
  { char: 'σ', latex: '\\sigma ', name: 'sigma' },
  { char: 'τ', latex: '\\tau ', name: 'tau' },
  { char: 'υ', latex: '\\upsilon ', name: 'upsilon' },
  { char: 'φ', latex: '\\phi ', name: 'phi' },
  { char: 'χ', latex: '\\chi ', name: 'chi' },
  { char: 'ψ', latex: '\\psi ', name: 'psi' },
  { char: 'ω', latex: '\\omega ', name: 'omega' },
];

const uppercaseGreek = [
  { char: 'Γ', latex: '\\Gamma ', name: 'Gamma' },
  { char: 'Δ', latex: '\\Delta ', name: 'Delta' },
  { char: 'Θ', latex: '\\Theta ', name: 'Theta' },
  { char: 'Λ', latex: '\\Lambda ', name: 'Lambda' },
  { char: 'Ξ', latex: '\\Xi ', name: 'Xi' },
  { char: 'Π', latex: '\\Pi ', name: 'Pi' },
  { char: 'Σ', latex: '\\Sigma ', name: 'Sigma' },
  { char: 'Φ', latex: '\\Phi ', name: 'Phi' },
  { char: 'Ψ', latex: '\\Psi ', name: 'Psi' },
  { char: 'Ω', latex: '\\Omega ', name: 'Omega' },
];

const constantsAndOperators = [
  { char: 'π', latex: '\\pi ', name: 'pi constant (3.14159...)' },
  { char: 'e', latex: 'e ', name: 'Euler constant (2.71828...)' },
  { char: 'i', latex: 'i ', name: 'Imaginary unit' },
  { char: '∞', latex: '\\infty ', name: 'Infinity' },
  { char: '∇', latex: '\\nabla ', name: 'Nabla / Gradient' },
  { char: '∂', latex: '\\partial ', name: 'Partial derivative' },
  { char: 'ℏ', latex: '\\hbar ', name: 'Reduced Planck constant' },
  { char: 'ℵ', latex: '\\aleph ', name: 'Aleph' },
];

export const GreekSymbolsPopover: React.FC<GreekSymbolsPopoverProps> = ({
  isOpen,
  onClose,
  anchorRef,
}) => {
  const { insertAtCursor } = useDocument();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'lowercase' | 'uppercase' | 'constants'>('lowercase');

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

  const currentList =
    tab === 'lowercase'
      ? lowercaseGreek
      : tab === 'uppercase'
      ? uppercaseGreek
      : constantsAndOperators;

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-1 z-50 bg-white rounded-md shadow-xl border border-slate-200 p-2.5 w-72 text-slate-800 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Pi className="w-3.5 h-3.5 text-[#242e84]" />
          <span>Greek & Mathematical Letters</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-2 bg-slate-100 p-0.5 rounded text-[11px]">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setTab('lowercase')}
          className={`flex-1 py-1 rounded text-center font-medium transition-colors ${
            tab === 'lowercase'
              ? 'bg-white text-[#242e84] shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Lowercase (α)
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setTab('uppercase')}
          className={`flex-1 py-1 rounded text-center font-medium transition-colors ${
            tab === 'uppercase'
              ? 'bg-white text-[#242e84] shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Uppercase (Ω)
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setTab('constants')}
          className={`flex-1 py-1 rounded text-center font-medium transition-colors ${
            tab === 'constants'
              ? 'bg-white text-[#242e84] shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Constants (π, e)
        </button>
      </div>

      {/* Symbol Grid */}
      <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto p-0.5">
        {currentList.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              insertAtCursor(item.latex);
              onClose();
            }}
            className="h-8 flex items-center justify-center bg-slate-50 hover:bg-[#242e84]/10 hover:text-[#242e84] hover:border-[#242e84]/40 text-slate-800 text-sm font-serif rounded border border-slate-200 transition-colors cursor-pointer"
            title={`${item.name} (${item.latex.trim()})`}
          >
            {item.char}
          </button>
        ))}
      </div>
    </div>
  );
};
