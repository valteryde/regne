import React, { useState, useRef, useEffect } from 'react';
import { useDocument } from '../../context/DocumentContext';
import {
  Grid3X3,
  Grid2X2,
  ChevronDown,
  Check,
} from 'lucide-react';
import { MatrixPickerPopover } from './MatrixPickerPopover';
import { GreekSymbolsPopover } from './GreekSymbolsPopover';

export const EquationRibbon: React.FC = () => {
  const { insertAtCursor, insertMatrix } = useDocument();

  // Popover states
  const [isMatrixPopoverOpen, setIsMatrixPopoverOpen] = useState(false);
  const matrixButtonRef = useRef<HTMLDivElement>(null);

  const [isGreekPopoverOpen, setIsGreekPopoverOpen] = useState(false);
  const greekButtonRef = useRef<HTMLDivElement>(null);

  // Dropdown menus for quick variants
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeDropdown) return;
    const handleDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [activeDropdown]);

  const toggleDropdown = (id: string) => {
    setActiveDropdown((prev) => (prev === id ? null : id));
  };

  const handleInsert = (snippet: string) => {
    insertAtCursor(snippet);
    setActiveDropdown(null);
  };

  return (
    <div className="flex items-stretch h-14 px-2 select-none overflow-visible text-slate-700 bg-white">
      {/* ========================================================================= */}
      {/* 1. FRACTIONS & RADICALS                                                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0 relative">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\frac{#?}{#?}')}
            className="h-7 px-2 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Fraction (a/b)"
          >
            <span className="leading-none">a/b</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\sqrt{#?}')}
            className="h-7 px-2 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Square Root (√x)"
          >
            <span className="leading-none">√x</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleDropdown('frac-rad')}
            className="h-7 w-4 flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-[2px] transition-colors cursor-pointer"
            title="More Fractions & Radicals"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Fractions & Radicals
        </div>

        {activeDropdown === 'frac-rad' && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 z-50 bg-white rounded-md shadow-lg border border-slate-200 py-1 w-44 text-xs select-none"
          >
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\frac{#?}{#?}')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Fraction</span>
              <span className="text-slate-400 font-mono text-[10px]">a/b</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\sqrt{#?}')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Square Root</span>
              <span className="text-slate-400 font-mono text-[10px]">√x</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\sqrt[#?]{#?}')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>N-th Root</span>
              <span className="text-slate-400 font-mono text-[10px]">ⁿ√x</span>
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\frac{d}{dx}\\left(#?\\right)')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Derivative</span>
              <span className="text-slate-400 font-mono text-[10px]">d/dx</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\frac{\\partial}{\\partial x}\\left(#?\\right)')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Partial Derivative</span>
              <span className="text-slate-400 font-mono text-[10px]">∂/∂x</span>
            </button>
          </div>
        )}
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 2. SCRIPT & LIMITS                                                        */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0 relative">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('#?^{#?}')}
            className="h-7 px-2 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Superscript / Power (x²)"
          >
            <span>x²</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\lim_{x \\to #?} #?')}
            className="h-7 px-2 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Limit (lim)"
          >
            <span>lim</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleDropdown('script-limits')}
            className="h-7 w-4 flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-[2px] transition-colors cursor-pointer"
            title="More Script & Limits"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Script & Limits
        </div>

        {activeDropdown === 'script-limits' && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 z-50 bg-white rounded-md shadow-lg border border-slate-200 py-1 w-44 text-xs select-none"
          >
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('#?^{#?}')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Superscript</span>
              <span className="text-slate-400 font-mono text-[10px]">xⁿ</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('#?_{#?}')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Subscript</span>
              <span className="text-slate-400 font-mono text-[10px]">xₙ</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('#?_{#?}^{#?}')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Sub & Super</span>
              <span className="text-slate-400 font-mono text-[10px]">xₙⁿ</span>
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\lim_{x \\to \\infty} #?')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Limit to ∞</span>
              <span className="text-slate-400 font-mono text-[10px]">lim x→∞</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\lim_{x \\to 0} #?')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Limit to 0</span>
              <span className="text-slate-400 font-mono text-[10px]">lim x→0</span>
            </button>
          </div>
        )}
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 3. MATRIX                                                                 */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0 relative" ref={matrixButtonRef}>
        <div className="flex items-center gap-1.5 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertMatrix(3, 3, 'pmatrix')}
            className="h-7 px-2 flex items-center gap-1 font-sans text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-slate-700"
            title="3×3 Matrix"
          >
            <Grid3X3 className="w-3.5 h-3.5 text-slate-500" />
            <span>3×3</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertMatrix(2, 2, 'pmatrix')}
            className="h-7 px-2 flex items-center gap-1 font-sans text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-slate-700"
            title="2×2 Matrix"
          >
            <Grid2X2 className="w-3.5 h-3.5 text-slate-500" />
            <span>2×2</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsMatrixPopoverOpen((v) => !v)}
            className={`h-7 w-4 flex items-center justify-center rounded-[2px] transition-colors cursor-pointer ${
              isMatrixPopoverOpen
                ? 'bg-slate-200 text-slate-900'
                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
            }`}
            title="Matrix Dimension Picker & Options"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Matrix
        </div>

        <MatrixPickerPopover
          isOpen={isMatrixPopoverOpen}
          onClose={() => setIsMatrixPopoverOpen(false)}
          anchorRef={matrixButtonRef}
        />
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 4. BIG OPERATORS                                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0 relative">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\int #?\\, dx')}
            className="h-7 w-7 flex items-center justify-center font-serif text-base font-normal hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Indefinite Integral (∫)"
          >
            <span>∫</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\sum_{i=#?}^{#?} #?')}
            className="h-7 w-7 flex items-center justify-center font-serif text-base font-normal hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Summation (∑)"
          >
            <span>∑</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\prod_{i=#?}^{#?} #?')}
            className="h-7 w-7 flex items-center justify-center font-serif text-base font-normal hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Product (∏)"
          >
            <span>∏</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleDropdown('big-operators')}
            className="h-7 w-4 flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-[2px] transition-colors cursor-pointer"
            title="More Big Operators"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Big Operators
        </div>

        {activeDropdown === 'big-operators' && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 z-50 bg-white rounded-md shadow-lg border border-slate-200 py-1 w-44 text-xs select-none"
          >
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\int_{#?}^{#?} #?\\, dx')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Definite Integral</span>
              <span className="text-slate-400 font-mono text-[10px]">∫ₐᵇ</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\iint #?\\, dA')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Double Integral</span>
              <span className="text-slate-400 font-mono text-[10px]">∬</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\oint #?\\, ds')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Contour Integral</span>
              <span className="text-slate-400 font-mono text-[10px]">∮</span>
            </button>
          </div>
        )}
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 5. ACCENTS & ARROWS                                                       */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0 relative">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\hat{#?}')}
            className="h-7 w-7 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Hat Accent (x̂)"
          >
            <span>x̂</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\to ')}
            className="h-7 w-7 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Right Arrow (→)"
          >
            <span>→</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\leftrightarrow ')}
            className="h-7 w-7 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Left-Right Arrow (↔)"
          >
            <span>↔</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleDropdown('accents-arrows')}
            className="h-7 w-4 flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-[2px] transition-colors cursor-pointer"
            title="More Accents & Arrows"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Accents & Arrows
        </div>

        {activeDropdown === 'accents-arrows' && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 z-50 bg-white rounded-md shadow-lg border border-slate-200 py-1 w-44 text-xs select-none"
          >
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\vec{#?}')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Vector Arrow</span>
              <span className="text-slate-400 font-mono text-[10px]">v⃗</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\bar{#?}')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Overline / Bar</span>
              <span className="text-slate-400 font-mono text-[10px]">x̄</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\dot{#?}')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>First Derivative Dot</span>
              <span className="text-slate-400 font-mono text-[10px]">ẋ</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\ddot{#?}')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Second Derivative Dot</span>
              <span className="text-slate-400 font-mono text-[10px]">ẍ</span>
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\implies ')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Implies</span>
              <span className="text-slate-400 font-mono text-[10px]">⇒</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\iff ')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Equivalent (if and only if)</span>
              <span className="text-slate-400 font-mono text-[10px]">⇔</span>
            </button>
          </div>
        )}
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 6. GREEK & LETTERS                                                        */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0 relative" ref={greekButtonRef}>
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\alpha ')}
            className="h-7 w-6 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Alpha (α)"
          >
            <span>α</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\beta ')}
            className="h-7 w-6 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Beta (β)"
          >
            <span>β</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\nabla ')}
            className="h-7 w-6 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Nabla / Gradient (∇)"
          >
            <span>∇</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\partial ')}
            className="h-7 w-6 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Partial (∂)"
          >
            <span>∂</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\pi ')}
            className="h-7 w-6 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-[#242e84]"
            title="Pi constant (π)"
          >
            <span>π</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('e ')}
            className="h-7 w-5 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-[#242e84]"
            title="Euler number (e)"
          >
            <span>e</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsGreekPopoverOpen((v) => !v)}
            className={`h-7 w-4 flex items-center justify-center rounded-[2px] transition-colors cursor-pointer ${
              isGreekPopoverOpen
                ? 'bg-slate-200 text-slate-900'
                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
            }`}
            title="Full Greek Alphabet & Constants Palette"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Greek & Letters
        </div>

        <GreekSymbolsPopover
          isOpen={isGreekPopoverOpen}
          onClose={() => setIsGreekPopoverOpen(false)}
          anchorRef={greekButtonRef}
        />
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 7. DELIMITERS                                                             */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0 relative">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\left(#?\\right)')}
            className="h-7 px-1.5 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Parentheses ( • )"
          >
            <span>( • )</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\left[#?\\right]')}
            className="h-7 px-1.5 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Brackets [ • ]"
          >
            <span>[ • ]</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsert('\\left\\{#?\\right\\}')}
            className="h-7 px-1.5 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Braces { • }"
          >
            <span>{'{ • }'}</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleDropdown('delimiters')}
            className="h-7 w-4 flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-[2px] transition-colors cursor-pointer"
            title="More Delimiters"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Delimiters
        </div>

        {activeDropdown === 'delimiters' && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 z-50 bg-white rounded-md shadow-lg border border-slate-200 py-1 w-44 text-xs select-none"
          >
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\left|#?\\right|')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Absolute Value</span>
              <span className="text-slate-400 font-mono text-[10px]">| • |</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\left\\|#?\\right\\|')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Norm / Double Bar</span>
              <span className="text-slate-400 font-mono text-[10px]">‖ • ‖</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\left\\langle#?\\right\\rangle')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Angle Brackets</span>
              <span className="text-slate-400 font-mono text-[10px]">⟨ • ⟩</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\left\\lfloor#?\\right\\rfloor')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Floor</span>
              <span className="text-slate-400 font-mono text-[10px]">⌊ • ⌋</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert('\\left\\lceil#?\\right\\rceil')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Ceiling</span>
              <span className="text-slate-400 font-mono text-[10px]">⌈ • ⌉</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
