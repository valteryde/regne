import React, { useState, useRef, useEffect } from 'react';
import { useDocument } from '../../context/DocumentContext';
import {
  Type,
  Plus,
  Heading,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Play,
  FastForward,
  Undo2,
  Redo2,
  ChevronDown,
  Check,
} from 'lucide-react';

export const MainRibbon: React.FC = () => {
  const {
    mode,
    setMode,
    activeElementId,
    convertElementType,
    insertElement,
    insertSection,
    insertAtCursor,
    updateElement,
    evaluateMath,
    evaluateAll,
    undo,
    redo,
    canUndo,
    canRedo,
    document: doc,
  } = useDocument();

  // Color states
  const [selectedColor, setSelectedColor] = useState<string>('#242e84');
  const [selectedHighlight, setSelectedHighlight] = useState<string>('#fef08a');
  const [isColorMenuOpen, setIsColorMenuOpen] = useState<boolean>(false);
  const [isHighlightMenuOpen, setIsHighlightMenuOpen] = useState<boolean>(false);
  const [isMoreMathOpen, setIsMoreMathOpen] = useState<boolean>(false);

  const colorMenuRef = useRef<HTMLDivElement>(null);
  const highlightMenuRef = useRef<HTMLDivElement>(null);
  const moreMathRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (colorMenuRef.current && !colorMenuRef.current.contains(target)) {
        setIsColorMenuOpen(false);
      }
      if (highlightMenuRef.current && !highlightMenuRef.current.contains(target)) {
        setIsHighlightMenuOpen(false);
      }
      if (moreMathRef.current && !moreMathRef.current.contains(target)) {
        setIsMoreMathOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, []);

  const mathElements = doc.elements.filter((el) => el.type === 'math');
  const isAnyEvaluating = mathElements.some((el) => el.isEvaluating);

  // Text / Math Color Palette
  const colorPalette = [
    { label: 'Auto (Default)', value: '' },
    { label: 'Royal Blue', value: '#242e84' },
    { label: 'Sky Blue', value: '#0284c7' },
    { label: 'Crimson Red', value: '#dc2626' },
    { label: 'Emerald Green', value: '#059669' },
    { label: 'Amber Orange', value: '#d97706' },
    { label: 'Violet Purple', value: '#7c3aed' },
    { label: 'Slate Gray', value: '#475569' },
    { label: 'Jet Black', value: '#000000' },
  ];

  // Highlight Palette
  const highlightPalette = [
    { label: 'No Color', value: 'transparent' },
    { label: 'Lemon Yellow', value: '#fef08a' },
    { label: 'Mint Green', value: '#bbf7d0' },
    { label: 'Ice Blue', value: '#bae6fd' },
    { label: 'Soft Pink', value: '#fbcfe8' },
    { label: 'Peach Orange', value: '#fed7aa' },
    { label: 'Lavender Purple', value: '#e9d5ff' },
  ];

  // Apply foreground color to text, math selection, or active element
  const applyColor = (color: string) => {
    setSelectedColor(color || '#242e84');
    setIsColorMenuOpen(false);

    // 1. If active MathField has focus/selection
    const activeMathField = (document.querySelector('math-field:focus') ||
      (document.activeElement?.tagName.toLowerCase() === 'math-field' ? document.activeElement : null) ||
      (activeElementId ? document.querySelector(`[data-element-id="${activeElementId}"] math-field`) : null)) as any;

    if (activeMathField && 'executeCommand' in activeMathField) {
      const sel = activeMathField.selection;
      if (sel && !sel.isCollapsed) {
        if (typeof activeMathField.applyStyle === 'function') {
          activeMathField.applyStyle({ color: color || undefined });
        } else {
          activeMathField.executeCommand(['applyStyle', { color: color || undefined }]);
        }
        try {
          activeMathField.focus({ preventScroll: true });
        } catch {
          activeMathField.focus();
        }
        return;
      }
    }

    // 2. If text selection exists in the document
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      if (color) {
        document.execCommand('foreColor', false, color);
      } else {
        document.execCommand('removeFormat', false);
      }
      return;
    }

    // 3. Update the whole active element
    if (activeElementId) {
      updateElement(activeElementId, { color: color || undefined });
    }
  };

  // Apply background / highlight color
  const applyHighlight = (bgColor: string) => {
    setSelectedHighlight(bgColor === 'transparent' ? '#fef08a' : bgColor);
    setIsHighlightMenuOpen(false);

    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      if (bgColor === 'transparent') {
        document.execCommand('removeFormat', false);
      } else {
        document.execCommand('hiliteColor', false, bgColor);
      }
      return;
    }

    if (activeElementId) {
      updateElement(activeElementId, {
        backgroundColor: bgColor === 'transparent' ? undefined : bgColor,
      });
    }
  };

  // Font formatting handler
  const handleFormat = (cmd: 'bold' | 'italic' | 'underline') => {
    const activeMathField = (document.querySelector('math-field:focus') ||
      (activeElementId ? document.querySelector(`[data-element-id="${activeElementId}"] math-field`) : null)) as any;

    if (activeMathField && 'executeCommand' in activeMathField) {
      if (cmd === 'bold') {
        activeMathField.executeCommand(['applyStyle', { series: 'bold' }]);
      } else if (cmd === 'italic') {
        activeMathField.executeCommand(['applyStyle', { shape: 'italic' }]);
      }
      try {
        activeMathField.focus({ preventScroll: true });
      } catch {
        activeMathField.focus();
      }
      return;
    }

    document.execCommand(cmd, false);
  };

  const handleInsertSnippet = (snippet: string) => {
    insertAtCursor(snippet);
    setIsMoreMathOpen(false);
  };

  return (
    <div className="flex items-stretch h-14 px-2 select-none overflow-visible text-slate-700 bg-white">
      {/* ========================================================================= */}
      {/* 1. AUTHORING MODE (Math vs Text)                                         */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center justify-center flex-1">
          <div className="inline-flex h-7 bg-white rounded-[3px] border border-slate-200 overflow-hidden text-xs items-center shadow-2xs">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setMode('text');
                if (activeElementId) {
                  convertElementType(activeElementId, 'text');
                }
              }}
              className={`h-full px-3 flex items-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'text'
                  ? 'bg-[#242e84] text-white font-semibold shadow-inner'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
              title="Switch to Text Mode (F5)"
            >
              <Type className="w-3.5 h-3.5" />
              <span>Text</span>
            </button>
            <div className="h-full w-px bg-slate-200" />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setMode('math');
                if (activeElementId) {
                  convertElementType(activeElementId, 'math');
                }
              }}
              className={`h-full px-3 flex items-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'math'
                  ? 'bg-[#242e84] text-white font-semibold shadow-inner'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
              title="Switch to Math Mode (F5)"
            >
              <span className="font-serif italic font-semibold">f(x)</span>
              <span>Math</span>
            </button>
          </div>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Mode
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 2. DOCUMENT STRUCTURE (Insert Line / Block / Section)                     */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertElement('math', activeElementId || undefined)}
            className="h-7 px-2 flex items-center gap-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors cursor-pointer text-slate-700"
            title="Insert Math Expression Line"
          >
            <Plus className="w-3.5 h-3.5 text-[#242e84]" />
            <span>Math</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertElement('text', activeElementId || undefined)}
            className="h-7 px-2 flex items-center gap-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors cursor-pointer text-slate-700"
            title="Insert Paragraph Text Block"
          >
            <Type className="w-3.5 h-3.5 text-slate-500" />
            <span>Text</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertSection(1, activeElementId || undefined, 'section', 'New Section')}
            className="h-7 px-2 flex items-center gap-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors cursor-pointer text-slate-700"
            title="Insert Document Section"
          >
            <Heading className="w-3.5 h-3.5 text-slate-500" />
            <span>Section</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Insert
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 3. FONT FORMATTING (Bold, Italic, Underline)                              */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-0.5 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleFormat('bold')}
            className="h-7 w-7 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="Bold (Cmd+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleFormat('italic')}
            className="h-7 w-7 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="Italic (Cmd+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleFormat('underline')}
            className="h-7 w-7 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="Underline (Cmd+U)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Font
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 4. COLOR & HIGHLIGHT                                                      */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          {/* Text / Math Color */}
          <div className="relative inline-flex items-center" ref={colorMenuRef}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyColor(selectedColor)}
              className="h-7 px-1.5 flex flex-col items-center justify-center hover:bg-slate-100 rounded-l transition-colors cursor-pointer"
              title={`Apply Text/Math Color (${selectedColor})`}
            >
              <span className="font-serif font-black text-xs leading-none text-slate-800">A</span>
              <div
                className="w-4 h-1 mt-0.5 rounded-xs"
                style={{ backgroundColor: selectedColor || '#242e84' }}
              />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsColorMenuOpen((v) => !v)}
              className={`h-7 px-1 flex items-center justify-center rounded-r hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-700 ${
                isColorMenuOpen ? 'bg-slate-100 text-slate-900' : ''
              }`}
              title="Color Palette"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {isColorMenuOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-md shadow-xl border border-slate-200 p-2 w-48 text-xs select-none">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                  Text & Math Color
                </div>
                <div className="grid grid-cols-3 gap-1 mb-2">
                  {colorPalette.map((col) => (
                    <button
                      key={col.label}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyColor(col.value)}
                      className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-slate-100 cursor-pointer text-left group"
                      title={col.label}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                        style={{ backgroundColor: col.value || '#1e293b' }}
                      />
                      <span className="text-[10px] text-slate-600 truncate">{col.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 pt-1.5 flex items-center justify-between px-1">
                  <span className="text-[10px] text-slate-500 font-medium">Custom:</span>
                  <input
                    type="color"
                    value={selectedColor || '#242e84'}
                    onChange={(e) => applyColor(e.target.value)}
                    className="w-6 h-6 p-0 border border-slate-200 rounded cursor-pointer"
                    title="Choose Custom Color"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Highlight Color */}
          <div className="relative inline-flex items-center" ref={highlightMenuRef}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyHighlight(selectedHighlight)}
              className="h-7 px-1.5 flex flex-col items-center justify-center hover:bg-slate-100 rounded-l transition-colors cursor-pointer"
              title={`Highlight Text (${selectedHighlight})`}
            >
              <Highlighter className="w-3 h-3 text-slate-700" />
              <div
                className="w-4 h-1 mt-0.5 rounded-xs"
                style={{ backgroundColor: selectedHighlight }}
              />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsHighlightMenuOpen((v) => !v)}
              className={`h-7 px-1 flex items-center justify-center rounded-r hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-700 ${
                isHighlightMenuOpen ? 'bg-slate-100 text-slate-900' : ''
              }`}
              title="Highlight Color Palette"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {isHighlightMenuOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-md shadow-xl border border-slate-200 p-2 w-44 text-xs select-none">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                  Text Highlight
                </div>
                <div className="flex flex-col gap-0.5">
                  {highlightPalette.map((hl) => (
                    <button
                      key={hl.label}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyHighlight(hl.value)}
                      className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-100 cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded border border-slate-300 shrink-0 shadow-2xs"
                          style={{
                            backgroundColor: hl.value === 'transparent' ? '#ffffff' : hl.value,
                            backgroundImage:
                              hl.value === 'transparent'
                                ? 'linear-gradient(45deg, #ef4444 50%, transparent 50%)'
                                : undefined,
                          }}
                        />
                        <span className="text-[11px] text-slate-700">{hl.label}</span>
                      </div>
                      {selectedHighlight === hl.value && (
                        <Check className="w-3 h-3 text-[#242e84]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Color
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 5. ESSENTIAL MATH TEMPLATES                                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0 relative" ref={moreMathRef}>
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertSnippet('\\frac{#?}{#?}')}
            className="h-7 px-2 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Fraction (a/b)"
          >
            <span>a/b</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertSnippet('\\sqrt{#?}')}
            className="h-7 px-2 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Square Root (√x)"
          >
            <span>√x</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertSnippet('#?^{#?}')}
            className="h-7 px-1.5 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Power / Superscript (x²)"
          >
            <span>x²</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertSnippet('#?_{#?}')}
            className="h-7 px-1.5 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Subscript (xₙ)"
          >
            <span>xₙ</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertSnippet('\\left(#?\\right)')}
            className="h-7 px-1.5 flex items-center justify-center font-serif text-sm font-medium hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer"
            title="Parentheses ( • )"
          >
            <span>( • )</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsMoreMathOpen((v) => !v)}
            className={`h-7 w-4 flex items-center justify-center rounded-[2px] hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-700 ${
              isMoreMathOpen ? 'bg-slate-100 text-slate-900' : ''
            }`}
            title="More Math Templates & Symbols"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Math
        </div>

        {isMoreMathOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-md shadow-xl border border-slate-200 py-1.5 w-52 text-xs select-none">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Templates
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsertSnippet('\\sqrt[#?]{#?}')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>N-th Root</span>
              <span className="text-slate-400 font-mono text-[10px]">ⁿ√x</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsertSnippet('\\int #?\\, dx')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Indefinite Integral</span>
              <span className="text-slate-400 font-mono text-[10px]">∫</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsertSnippet('\\sum_{i=#?}^{#?} #?')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Summation</span>
              <span className="text-slate-400 font-mono text-[10px]">∑</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsertSnippet('\\left|#?\\right|')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left font-serif"
            >
              <span>Absolute Value</span>
              <span className="text-slate-400 font-mono text-[10px]">| • |</span>
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Symbols
            </div>
            <div className="grid grid-cols-4 gap-1 px-3 py-1">
              {[
                { label: '±', latex: '\\pm ' },
                { label: '·', latex: '\\cdot ' },
                { label: '≠', latex: '\\neq ' },
                { label: '≈', latex: '\\approx ' },
                { label: '≤', latex: '\\leq ' },
                { label: '≥', latex: '\\geq ' },
                { label: 'π', latex: '\\pi ' },
                { label: '∞', latex: '\\infty ' },
              ].map((sym) => (
                <button
                  key={sym.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleInsertSnippet(sym.latex)}
                  className="h-7 flex items-center justify-center font-serif text-sm rounded hover:bg-slate-100 hover:text-slate-900 border border-slate-100"
                  title={`Insert ${sym.label}`}
                >
                  {sym.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 6. CAS SOLVER (Calculate)                                                */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1.5 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (activeElementId) {
                evaluateMath(activeElementId);
              }
            }}
            disabled={!activeElementId || isAnyEvaluating}
            className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold bg-[#242e84] text-white hover:bg-[#1a226b] disabled:opacity-50 rounded-[2px] transition-colors cursor-pointer shadow-2xs"
            title="Evaluate currently active math expression (Enter)"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Evaluate</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={evaluateAll}
            disabled={isAnyEvaluating || mathElements.length === 0}
            className="h-7 px-2 flex items-center gap-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-50 rounded-[2px] border border-slate-200 transition-colors cursor-pointer"
            title="Evaluate entire document top-to-bottom (Shift+Cmd+Enter)"
          >
            <FastForward className="w-3.5 h-3.5 text-slate-500" />
            <span>All</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Calculate
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* ========================================================================= */}
      {/* 7. HISTORY (Undo / Redo)                                                  */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={undo}
            disabled={!canUndo}
            className="h-7 w-7 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 rounded transition-colors cursor-pointer"
            title="Undo (Cmd+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={redo}
            disabled={!canRedo}
            className="h-7 w-7 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 rounded transition-colors cursor-pointer"
            title="Redo (Shift+Cmd+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          History
        </div>
      </div>
    </div>
  );
};
