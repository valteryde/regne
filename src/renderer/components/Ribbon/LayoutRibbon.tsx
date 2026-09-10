import React, { useRef, useState, useEffect } from 'react';
import { useDocument } from '../../context/DocumentContext';
import {
  Ruler,
  ChevronDown,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Type,
  Plus,
} from 'lucide-react';

export const LayoutRibbon: React.FC = () => {
  const {
    mode,
    setMode,
    activeElementId,
    convertElementType,
    insertElement,
    insertSection,
    isRulerVisible,
    toggleRuler,
    rulerPosition,
    setRulerPosition,
    setRulerVisible,
    zoom,
    setZoom,
  } = useDocument();

  const [isRulerMenuOpen, setIsRulerMenuOpen] = useState(false);
  const rulerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRulerMenuOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (rulerMenuRef.current && !rulerMenuRef.current.contains(e.target as Node)) {
        setIsRulerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [isRulerMenuOpen]);

  return (
    <div className="flex items-stretch h-14 px-2 select-none overflow-visible text-slate-700 bg-white">
      {/* 1. AUTHORING MODE */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center justify-center flex-1">
          <div className="inline-flex h-7 bg-white rounded-[2px] border border-slate-200 overflow-hidden text-xs items-center shadow-2xs">
            <button
              onClick={() => {
                setMode('text');
                if (activeElementId) {
                  convertElementType(activeElementId, 'text');
                }
              }}
              className={`h-full px-3 flex items-center transition-colors cursor-pointer ${
                mode === 'text'
                  ? 'bg-[#242e84] text-white font-semibold'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
              title="Text Mode (F5)"
            >
              Text
            </button>
            <div className="h-full w-px bg-slate-200" />
            <button
              onClick={() => {
                setMode('math');
                if (activeElementId) {
                  convertElementType(activeElementId, 'math');
                }
              }}
              className={`h-full px-3 flex items-center transition-colors cursor-pointer ${
                mode === 'math'
                  ? 'bg-[#242e84] text-white font-semibold'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
              title="Math Mode (F5)"
            >
              Math
            </button>
          </div>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Authoring Mode
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* 2. STRUCTURE INSERTION */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onClick={() => insertElement('math', activeElementId || undefined)}
            className="h-7 px-2 flex items-center gap-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors cursor-pointer text-slate-700"
            title="Insert Math Expression Line"
          >
            <Plus className="w-3.5 h-3.5 text-[#242e84]" />
            <span>Math Line</span>
          </button>
          <button
            type="button"
            onClick={() => insertElement('text', activeElementId || undefined)}
            className="h-7 px-2 flex items-center gap-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors cursor-pointer text-slate-700"
            title="Insert Paragraph Text Block"
          >
            <Type className="w-3.5 h-3.5 text-slate-500" />
            <span>Text Block</span>
          </button>
          <button
            type="button"
            onClick={() => insertSection(1, activeElementId || undefined, 'section', 'New Section')}
            className="h-7 px-2 flex items-center gap-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors cursor-pointer text-slate-700"
            title="Insert Document Section"
          >
            <span>Section</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Document Structure
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* 4. ZOOM CONTROLS */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(1))))}
            className="h-7 w-7 flex items-center justify-center hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-xs font-semibold text-slate-700 px-1 select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(2.0, Number((prev + 0.1).toFixed(1))))}
            className="h-7 w-7 flex items-center justify-center hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1.0)}
            className="h-7 px-1.5 flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="Reset to 100%"
          >
            <RotateCcw className="w-3 h-3" />
            <span>100%</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Scale & View
        </div>
      </div>
    </div>
  );
};
