import React, { useState, useEffect, useRef } from 'react';
import { useDocument } from '../../context/DocumentContext';
import { KaTeXRenderer } from '../Worksheet/KaTeXRenderer';
import { Code, X, Check, Copy } from 'lucide-react';

interface TeXRawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeXRawModal: React.FC<TeXRawModalProps> = ({ isOpen, onClose }) => {
  const { insertRawTeX } = useDocument();
  const [latexInput, setLatexInput] = useState<string>('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInsert = () => {
    if (latexInput.trim()) {
      insertRawTeX(latexInput.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleInsert();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const presets = [
    { label: 'Gaussian Integral', latex: '\\int_{-\\infty}^{\\infty} e^{-x^{2}} \\, dx = \\sqrt{\\pi}' },
    { label: 'Euler Identity', latex: 'e^{i \\pi} + 1 = 0' },
    { label: 'Quadratic Formula', latex: 'x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}' },
    { label: 'Cauchy Integral', latex: 'f(a) = \\frac{1}{2\\pi i} \\oint_{\\gamma} \\frac{f(z)}{z - a} \\, dz' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col text-slate-800"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Code className="w-4 h-4 text-[#242e84]" />
            <span>Direct TeX / LaTeX Input</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              LaTeX Code (macros, symbols, environments):
            </label>
            <textarea
              ref={inputRef}
              rows={4}
              value={latexInput}
              onChange={(e) => setLatexInput(e.target.value)}
              placeholder="e.g. \frac{1}{\sqrt{2\pi\sigma^2}} \exp\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)"
              className="w-full p-2.5 font-mono text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-hidden focus:border-[#242e84] focus:ring-1 focus:ring-[#242e84] text-slate-900 placeholder:text-slate-400 resize-y"
            />
          </div>

          {/* Quick Presets */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Sample Snippets
            </div>
            <div className="flex flex-wrap gap-1">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLatexInput(p.latex)}
                  className="px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live KaTeX Preview Box */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Typeset Preview
            </div>
            <div className="min-h-16 p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-center overflow-x-auto text-slate-900">
              {latexInput.trim() ? (
                <KaTeXRenderer math={latexInput.trim()} displayMode={true} />
              ) : (
                <span className="text-xs text-slate-400 italic">
                  Typeset equation will preview here
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            Tip: Press <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Cmd</kbd>+<kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Enter</kbd> to insert
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!latexInput.trim()}
              onClick={handleInsert}
              className="px-3 py-1.5 bg-[#242e84] hover:bg-[#1a226b] disabled:opacity-50 text-white rounded font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Insert into Equation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
