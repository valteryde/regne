import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useDocument } from '../../context/DocumentContext';
import { MathField, MathFieldHandle } from '../MathEditor/MathField';
import { KaTeXRenderer } from '../Worksheet/KaTeXRenderer';
import { DocumentElement, ElementType, SectionElement, SectionKind, TextElement } from '../../../types/document';
import { computeOutline, getCollapsedElementIds, OutlineItem } from '../../utils/outline';
import { SectionLine } from './SectionLine';
import { ChevronRight, X } from 'lucide-react';
import {
  caretAtStart,
  caretAtEnd,
  caretOnFirstLine,
  caretOnLastLine,
  placeCaretAtCharOffset,
  selectionCoversAll,
  htmlTextLength,
} from '../../utils/caret';

interface SelectionRange {
  start: number;
  end: number;
}

// ---------------------------------------------------------------------------
// TextLine: Smooth, native, uncontrolled contentEditable line.
// Prevents React from resetting DOM caret on keystrokes.
// ---------------------------------------------------------------------------
interface TextLineProps {
  id: string;
  index: number;
  content: string;
  color?: string;
  backgroundColor?: string;
  isActive: boolean;
  isSelected: boolean;
  onFocus: () => void;
  onChange: (newContent: string) => void;
  onConvertToSection?: (level: 1 | 2 | 3, kind?: SectionKind, title?: string) => void;
  onSplit: (headHtml: string, tailHtml: string) => void;
  onInsertBelow: () => void;
  onBackspaceEmpty: () => void;
  onBackspaceAtStart: () => void;
  onDeleteAtEnd: () => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onRowMouseDown: (e: React.MouseEvent) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}

const TextLine: React.FC<TextLineProps> = memo(({
  id,
  index,
  content,
  color,
  backgroundColor,
  isActive,
  isSelected,
  onFocus,
  onChange,
  onConvertToSection,
  onSplit,
  onInsertBelow,
  onBackspaceEmpty,
  onBackspaceAtStart,
  onDeleteAtEnd,
  onNavigateUp,
  onNavigateDown,
  onRowMouseDown,
  registerRef,
}) => {
  const elRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedContentRef = useRef<string>(content || '');

  // Synchronize text from state when changed externally (e.g. Undo, Redo, Paste)
  useEffect(() => {
    if (!elRef.current) return;
    if (content === lastEmittedContentRef.current && elRef.current.innerHTML === content) {
      return;
    }
    lastEmittedContentRef.current = content || '';
    if (elRef.current.innerHTML !== content) {
      elRef.current.innerHTML = content || '';
      if (document.activeElement === elRef.current) {
        try {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(elRef.current);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch {
          // ignore
        }
      }
    }
  }, [content]);

  // Set initial content on mount
  useEffect(() => {
    if (elRef.current) {
      elRef.current.innerHTML = content || '';
      lastEmittedContentRef.current = content || '';
    }
  }, []);

  return (
    <div
      data-element-id={id}
      data-element-idx={index}
      className={`group py-[1px] px-1 cursor-text transition-colors select-text ${
        isSelected ? 'bg-[var(--selection-bg)] maple-selected' : 'bg-transparent'
      }`}
      style={backgroundColor ? { backgroundColor } : undefined}
      onMouseDown={onRowMouseDown}
      onClick={() => {
        if (!isSelected) {
          onFocus();
          try {
            elRef.current?.focus({ preventScroll: true });
          } catch {
            elRef.current?.focus();
          }
        }
      }}
    >
      <div className="min-h-[1.3em]">
        <div
          ref={(r) => {
            elRef.current = r;
            registerRef(r);
          }}
          contentEditable={true}
          suppressContentEditableWarning={true}
          style={color ? { color } : undefined}
          onFocus={onFocus}
          onInput={(e) => {
            const htmlVal = e.currentTarget.innerHTML;
            lastEmittedContentRef.current = htmlVal;
            const textVal = e.currentTarget.innerText;
            // Quick markdown triggers for converting to section
            if (onConvertToSection) {
              if (textVal.startsWith('### ')) {
                onConvertToSection(3, 'subsubsection', textVal.slice(4));
                return;
              }
              if (textVal.startsWith('## ')) {
                onConvertToSection(2, 'subsection', textVal.slice(3));
                return;
              }
              if (textVal.startsWith('# ')) {
                onConvertToSection(1, 'section', textVal.slice(2));
                return;
              }
              if (textVal.toLowerCase().startsWith('theorem: ')) {
                onConvertToSection(2, 'theorem', textVal.slice(9));
                return;
              }
              if (textVal.toLowerCase().startsWith('lemma: ')) {
                onConvertToSection(2, 'lemma', textVal.slice(7));
                return;
              }
            }
            onChange(htmlVal);
          }}
          onKeyDown={(e) => {
            const el = e.currentTarget;
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (e.metaKey || e.ctrlKey) {
                onInsertBelow();
                return;
              }
              const sel = window.getSelection();
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (!range.collapsed) range.deleteContents();
                const caret = sel.getRangeAt(0);
                const tailRange = document.createRange();
                tailRange.selectNodeContents(el);
                tailRange.setStart(caret.endContainer, caret.endOffset);
                const frag = tailRange.extractContents();
                const tmp = document.createElement('div');
                tmp.appendChild(frag);
                onSplit(el.innerHTML, tmp.innerHTML);
              } else {
                onSplit(el.innerHTML, '');
              }
            } else if (e.key === 'Backspace') {
              const text = el.innerText.trim();
              if (text === '') {
                e.preventDefault();
                onBackspaceEmpty();
              } else if (caretAtStart(el)) {
                e.preventDefault();
                onBackspaceAtStart();
              }
            } else if (e.key === 'Delete') {
              if (el.innerText.trim() !== '' && caretAtEnd(el)) {
                e.preventDefault();
                onDeleteAtEnd();
              }
            } else if (e.key === 'ArrowUp') {
              if (caretOnFirstLine(el)) {
                e.preventDefault();
                onNavigateUp();
              }
            } else if (e.key === 'ArrowDown') {
              if (caretOnLastLine(el)) {
                e.preventDefault();
                onNavigateDown();
              }
            } else if (e.key === 'ArrowLeft' && !e.shiftKey) {
              if (caretAtStart(el)) {
                e.preventDefault();
                onNavigateUp();
              }
            } else if (e.key === 'ArrowRight' && !e.shiftKey) {
              if (caretAtEnd(el)) {
                e.preventDefault();
                onNavigateDown();
              }
            }
          }}
          className="w-full outline-none font-serif text-[17px] leading-[1.3] text-[var(--text-primary)] min-h-[1.3em] select-text"
        />
      </div>
    </div>
  );
});

TextLine.displayName = 'TextLine';

// ---------------------------------------------------------------------------
// MathLine: Real 2D WYSIWYG Math formula with evaluated royal blue result.
// ---------------------------------------------------------------------------
interface MathLineProps {
  id: string;
  index: number;
  input: string;
  evaluated: boolean;
  resultLatex?: string;
  resultText?: string;
  resultPlotSvg?: string;
  resultType?: string;
  error?: string;
  errorCol?: number;
  errorSource?: string;
  isEvaluating?: boolean;
  color?: string;
  backgroundColor?: string;
  isActive: boolean;
  isSelected: boolean;
  onFocus: () => void;
  onChange: (newContent: string) => void;
  onEvaluate: () => void;
  onEvaluateInPlace: () => void;
  onInsertBelow: () => void;
  onUnevaluate: () => void;
  onDeleteEmpty: () => void;
  onBackspaceAtStart: () => void;
  onDeleteAtEnd: () => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onRowMouseDown: (e: React.MouseEvent) => void;
  registerRef: (h: MathFieldHandle | null) => void;
}

const MathLine: React.FC<MathLineProps> = memo(({
  id,
  index,
  input,
  evaluated,
  resultLatex,
  resultText,
  resultPlotSvg,
  resultType,
  error,
  errorCol,
  errorSource,
  isEvaluating,
  color,
  backgroundColor,
  isActive,
  isSelected,
  onFocus,
  onChange,
  onEvaluate,
  onEvaluateInPlace,
  onInsertBelow,
  onUnevaluate,
  onDeleteEmpty,
  onBackspaceAtStart,
  onDeleteAtEnd,
  onNavigateUp,
  onNavigateDown,
  onRowMouseDown,
  registerRef,
}) => {
  const mfHandleRef = useRef<MathFieldHandle | null>(null);
  const [resultSelected, setResultSelected] = useState(false);
  const resultAreaRef = useRef<HTMLDivElement | null>(null);

  // Deselect result when clicking outside or pressing Escape; delete on Backspace/Delete
  useEffect(() => {
    if (!resultSelected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        e.stopPropagation();
        setResultSelected(false);
        onUnevaluate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setResultSelected(false);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (resultAreaRef.current && !resultAreaRef.current.contains(e.target as Node)) {
        setResultSelected(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [resultSelected, onUnevaluate]);

  // Deselect result when the element is no longer evaluated
  useEffect(() => {
    if (!evaluated) setResultSelected(false);
  }, [evaluated]);

  return (
    <div
      data-element-id={id}
      data-element-idx={index}
      className={`group py-[1px] px-1 cursor-text transition-colors select-text ${
        isSelected ? 'bg-[var(--selection-bg)] maple-selected' : 'bg-transparent'
      }`}
      style={backgroundColor ? { backgroundColor } : undefined}
      onMouseDown={onRowMouseDown}
      onClick={() => {
        if (!isSelected) {
          onFocus();
          mfHandleRef.current?.focus();
        }
      }}
    >
      {/* 2D Math formula */}
      <div className="min-h-[1.3em] select-text">
        <MathField
          ref={(h) => {
            mfHandleRef.current = h;
            registerRef(h);
          }}
          value={input}
          onChange={onChange}
          onFocus={onFocus}
          onEvaluate={onEvaluate}
          onEvaluateInPlace={onEvaluateInPlace}
          onInsertBelow={onInsertBelow}
          onDelete={onDeleteEmpty}
          onBackspaceAtStart={onBackspaceAtStart}
          onDeleteAtEnd={onDeleteAtEnd}
          onNavigateUp={onNavigateUp}
          onNavigateDown={onNavigateDown}
          fontSize="1.25rem"
          color={color || "var(--math-input-color)"}
          className="w-full"
        />
      </div>

      {/* Evaluated Royal Blue 2D Result or Kaxe Plot */}
      {isEvaluating ? (
        <div className="py-0.5 pl-6 font-mono text-xs text-[var(--text-muted)] italic select-text">
          Evaluating...
        </div>
      ) : error ? (
        <div
          ref={resultAreaRef}
          className={`group/result relative flex flex-col gap-0.5 py-0.5 pl-6 select-text cursor-pointer rounded-sm transition-colors ${
            resultSelected ? 'bg-blue-100 ring-1 ring-blue-300' : ''
          }`}
          onClick={(e) => { e.stopPropagation(); setResultSelected(!resultSelected); }}
        >
          {/* Error message row */}
          <div className="flex items-start gap-1">
            <span className="text-red-600 text-xs font-mono leading-snug">
              ✕ {error}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onUnevaluate(); }}
              className="ml-auto opacity-0 group-hover/result:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 cursor-pointer"
              title="Clear result"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {/* Source snippet with caret highlight */}
          {errorSource != null && errorCol != null && (
            <div className="font-mono text-xs leading-snug overflow-x-auto">
              <div className="text-[var(--text-muted)] whitespace-pre">{errorSource}</div>
              <div className="text-red-500 whitespace-pre select-none" aria-hidden>
                {' '.repeat(Math.max(0, errorCol))}^
              </div>
            </div>
          )}
        </div>
      ) : evaluated && (resultPlotSvg || resultType === 'plot') ? (
        <div
          ref={resultAreaRef}
          className={`group/result relative py-1.5 pl-6 select-text cursor-pointer rounded-sm transition-colors ${
            resultSelected ? 'bg-blue-100 ring-1 ring-blue-300' : ''
          }`}
          onClick={(e) => { e.stopPropagation(); setResultSelected(!resultSelected); }}
        >
          <div className="relative group/plot inline-block w-full max-w-[560px] rounded border border-slate-200 bg-white p-2 shadow-xs transition-shadow hover:shadow-sm">
            <div
              className="w-full h-auto overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
              dangerouslySetInnerHTML={{ __html: resultPlotSvg || '' }}
            />
            {/* Quick Actions: copy SVG + dismiss */}
            <div className="absolute top-2 right-2 opacity-0 group-hover/plot:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 backdrop-blur-xs border border-slate-200 rounded px-1.5 py-0.5 shadow-2xs">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (resultPlotSvg) {
                    navigator.clipboard.writeText(resultPlotSvg);
                  }
                }}
                className="text-[10px] text-slate-600 hover:text-slate-900 cursor-pointer font-sans select-none"
                title="Copy SVG to clipboard"
              >
                Copy SVG
              </button>
              <span className="text-slate-300 select-none">|</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onUnevaluate(); }}
                className="text-[10px] text-slate-500 hover:text-red-600 cursor-pointer font-sans select-none flex items-center gap-0.5"
                title="Clear result"
              >
                <X className="w-2.5 h-2.5" /> Clear
              </button>
            </div>
          </div>
        </div>
      ) : evaluated && resultLatex ? (
        <div
          ref={resultAreaRef}
          className={`group/result relative flex items-center gap-1 py-1 pl-6 select-text overflow-x-auto overflow-y-hidden cursor-pointer rounded-sm transition-colors ${
            resultSelected ? 'bg-blue-100 ring-1 ring-blue-300' : ''
          }`}
          style={color ? { color } : undefined}
          onClick={(e) => { e.stopPropagation(); setResultSelected(!resultSelected); }}
        >
          <KaTeXRenderer
            math={resultLatex}
            displayMode={false}
            className="select-text flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUnevaluate(); }}
            className="opacity-0 group-hover/result:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer ml-2"
            title="Clear result"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
});

MathLine.displayName = 'MathLine';

// ---------------------------------------------------------------------------
// MathDocument: Continuous Word-like mathematical document workspace.
// ---------------------------------------------------------------------------
interface MathDocumentProps {
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const MathDocument: React.FC<MathDocumentProps> = ({ containerRef: externalContainerRef }) => {
  const {
    document: doc,
    activeElementId,
    setActiveElementId,
    mode,
    setMode,
    zoom,
    setTitle,
    updateElement,
    convertElementType,
    insertElement,
    insertSection,
    toggleSectionCollapse,
    scrollToElement,
    deleteElement,
    setElements,
    evaluateMath,
    unevaluateMath,
    activeInputRef,
    saveDocument,
    openDocument,
    newDocument,
    undo,
    redo,
    pageMargins,
    paperWidth,
    focusRequest,
  } = useDocument();

  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const elementsContainerRef = useRef<HTMLDivElement | null>(null);
  const textRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const mathRefs = useRef<Map<string, MathFieldHandle>>(new Map());
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Focus and conversion tracking
  const pendingFocusIdRef = useRef<{ id: string; atEnd: boolean; offset?: number } | null>(null);
  const prevElementTypesRef = useRef<Map<string, ElementType>>(new Map());

  // Multi-element selection range
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const selectionRangeRef = useRef<SelectionRange | null>(null);
  const dragStartRef = useRef<{ y: number; idx: number } | null>(null);
  const isDraggingRowsRef = useRef<boolean>(false);

  // Compute outline tree and folded elements
  const outlineItems = useMemo(() => computeOutline(doc.elements), [doc.elements]);
  const outlineMap = useMemo(() => {
    const map = new Map<string, OutlineItem>();
    outlineItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [outlineItems]);
  const collapsedElementIds = useMemo(() => getCollapsedElementIds(doc.elements), [doc.elements]);
  const visibleElements = useMemo(
    () => doc.elements.filter((el) => !collapsedElementIds.has(el.id)),
    [doc.elements, collapsedElementIds]
  );

  // Index of the nearest rendered (non-hidden) element at or after `index`.
  // Falls back to searching backwards, returns -1 when nothing is visible.
  const nearestVisibleIndex = useCallback(
    (elements: DocumentElement[], index: number): number => {
      let i = Math.max(0, Math.min(index, elements.length - 1));
      while (i < elements.length && collapsedElementIds.has(elements[i].id)) i++;
      if (i < elements.length) return i;
      i = Math.max(0, Math.min(index, elements.length - 1));
      while (i >= 0 && collapsedElementIds.has(elements[i].id)) i--;
      return i;
    },
    [collapsedElementIds]
  );

  const updateSelectionRange = useCallback((range: SelectionRange | null) => {
    selectionRangeRef.current = range;
    setSelectionRange(range);
  }, []);

  // Directly attempt to focus an element by ID via handles or DOM
  const focusElementById = useCallback((id: string, atEnd = false, offset?: number): boolean => {
    setActiveElementId(id);

    // 1. Try section refs
    const secEl = sectionRefs.current.get(id);
    if (secEl && document.body.contains(secEl)) {
      try {
        secEl.focus({ preventScroll: true });
      } catch {
        secEl.focus();
      }
      try {
        if (offset !== undefined) {
          placeCaretAtCharOffset(secEl, offset);
        } else {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(secEl);
            range.collapse(!atEnd);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      } catch {
        // ignore
      }
      activeInputRef.current = secEl as any;
      return true;
    }

    // 2. Try math refs
    const mf = mathRefs.current.get(id);
    if (mf) {
      mf.focus(atEnd);
      return true;
    }

    // 3. Try text refs
    const textEl = textRefs.current.get(id);
    if (textEl && document.body.contains(textEl)) {
      try {
        textEl.focus({ preventScroll: true });
      } catch {
        textEl.focus();
      }
      try {
        if (offset !== undefined) {
          placeCaretAtCharOffset(textEl, offset);
        } else {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(textEl);
            range.collapse(!atEnd);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      } catch {
        // ignore
      }
      activeInputRef.current = textEl as any;
      return true;
    }

    // 4. Fallback: DOM query inside elements container
    if (elementsContainerRef.current) {
      const row = elementsContainerRef.current.querySelector(`[data-element-id="${id}"]`);
      if (row) {
        const mfEl = row.querySelector('math-field') as any;
        if (mfEl && typeof mfEl.focus === 'function') {
          try {
            mfEl.focus({ preventScroll: true });
          } catch {
            mfEl.focus();
          }
          return true;
        }
        const ceEl = row.querySelector('[contenteditable="true"]') as HTMLElement | null;
        if (ceEl) {
          try {
            ceEl.focus({ preventScroll: true });
          } catch {
            ceEl.focus();
          }
          activeInputRef.current = ceEl as any;
          return true;
        }
      }
    }

    return false;
  }, [setActiveElementId, activeInputRef]);

  // Repeatedly attempt to focus across animation frames until mounted
  const ensureFocusById = useCallback((id: string, atEnd = false, offset?: number, attempts = 20) => {
    pendingFocusIdRef.current = { id, atEnd, offset };
    setActiveElementId(id);

    const tryFocus = (remaining: number) => {
      if (pendingFocusIdRef.current?.id !== id) return;

      if (focusElementById(id, atEnd, pendingFocusIdRef.current.offset)) {
        pendingFocusIdRef.current = null;
        return;
      }

      if (remaining > 0) {
        requestAnimationFrame(() => tryFocus(remaining - 1));
      }
    };

    tryFocus(attempts);
  }, [focusElementById, setActiveElementId]);

  // Focus an element by index (resolves hidden elements to the nearest visible one)
  const focusElement = useCallback((index: number, atEnd = false) => {
    if (doc.elements.length === 0) return;
    const targetIdx = nearestVisibleIndex(doc.elements, index);
    if (targetIdx === -1) return;
    ensureFocusById(doc.elements[targetIdx].id, atEnd);
  }, [doc.elements, ensureFocusById, nearestVisibleIndex]);

  // Move focus to the previous/next *visible* element relative to `id`.
  // dir=-1 lands the caret at the end of the previous element; dir=+1 at the
  // start of the next. Moving up past the first element focuses the title.
  const focusNeighborOf = useCallback(
    (id: string, dir: -1 | 1) => {
      const pos = visibleElements.findIndex((e) => e.id === id);
      const target = pos !== -1 ? visibleElements[pos + dir] : undefined;
      if (target) {
        ensureFocusById(target.id, dir === -1);
      } else if (dir === -1 && titleInputRef.current) {
        setActiveElementId(null);
        const titleEl = titleInputRef.current;
        try {
          titleEl.focus({ preventScroll: true });
        } catch {
          titleEl.focus();
        }
        try {
          titleEl.setSelectionRange(titleEl.value.length, titleEl.value.length);
        } catch {
          // ignore
        }
      }
    },
    [visibleElements, ensureFocusById, setActiveElementId]
  );

  // React to document element changes: fulfill pending focus & auto-focus converted lines
  const prevElementCountRef = useRef<number>(doc.elements.length);
  const prevElementIdsRef = useRef<string[]>(doc.elements.map((e) => e.id));
  useEffect(() => {
    const prevCount = prevElementCountRef.current;
    const prevIds = prevElementIdsRef.current;
    const currCount = doc.elements.length;
    prevElementCountRef.current = currCount;
    prevElementIdsRef.current = doc.elements.map((e) => e.id);

    // An element was deleted — auto-focus the nearest surviving element so the user
    // doesn't have to click/mouse to regain focus after deletion.
    // Skip if pendingFocusIdRef is already set (e.g. onBackspaceEmpty already requested focus).
    if (currCount < prevCount && !pendingFocusIdRef.current) {
      // Find which element was removed and focus the element that now occupies its slot
      const currentIds = new Set(doc.elements.map((e) => e.id));
      const deletedIdx = prevIds.findIndex((id) => !currentIds.has(id));
      if (deletedIdx !== -1 && doc.elements.length > 0) {
        const targetIdx = nearestVisibleIndex(doc.elements, deletedIdx);
        const targetId = targetIdx !== -1 ? doc.elements[targetIdx]?.id : undefined;
        if (targetId) {
          ensureFocusById(targetId, true);
        }
      }
    }

    if (pendingFocusIdRef.current) {
      const { id, atEnd, offset } = pendingFocusIdRef.current;
      ensureFocusById(id, atEnd, offset);
    }

    doc.elements.forEach((el) => {
      const prevType = prevElementTypesRef.current.get(el.id);
      if (prevType && prevType !== el.type) {
        // Element was converted (Math <-> Text) - immediately focus it
        ensureFocusById(el.id, true);
      }
      prevElementTypesRef.current.set(el.id, el.type);
    });

    const currentIds = new Set(doc.elements.map((e) => e.id));
    for (const id of prevElementTypesRef.current.keys()) {
      if (!currentIds.has(id)) {
        prevElementTypesRef.current.delete(id);
      }
    }
  }, [doc.elements, ensureFocusById, nearestVisibleIndex]);

  // External focus requests (menu commands, context-level inserts)
  useEffect(() => {
    if (!focusRequest) return;
    ensureFocusById(focusRequest.id, focusRequest.atEnd, focusRequest.offset);
  }, [focusRequest, ensureFocusById]);

  // Global mouse drag selection across lines
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT') return;

      const row = target?.closest?.('[data-element-idx]') as HTMLElement | null;
      if (row && row.dataset.elementIdx !== undefined) {
        const idx = parseInt(row.dataset.elementIdx, 10);
        dragStartRef.current = { y: e.clientY, idx };
        isDraggingRowsRef.current = false;
        if (!e.shiftKey && selectionRangeRef.current !== null) {
          updateSelectionRange(null);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (e.buttons !== 1 || !dragStartRef.current) return;

      const dy = Math.abs(e.clientY - dragStartRef.current.y);

      // Try elementFromPoint first; it fails on empty lines (no content to hit)
      const currentEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      let currentRow = currentEl?.closest?.('[data-element-idx]') as HTMLElement | null;

      // Fallback: find the nearest row by Y-midpoint proximity when the cursor
      // lands in a gap or on an empty-line element that has no [data-element-idx] ancestor.
      if (!currentRow && elementsContainerRef.current) {
        const rows = elementsContainerRef.current.querySelectorAll<HTMLElement>('[data-element-idx]');
        let bestRow: HTMLElement | null = null;
        let bestDist = Infinity;
        rows.forEach((row) => {
          const rect = row.getBoundingClientRect();
          const midY = (rect.top + rect.bottom) / 2;
          const dist = Math.abs(e.clientY - midY);
          if (dist < bestDist) {
            bestDist = dist;
            bestRow = row;
          }
        });
        currentRow = bestRow;
      }

      if (currentRow && currentRow.dataset.elementIdx !== undefined) {
        const currentIdx = parseInt(currentRow.dataset.elementIdx, 10);
        if (currentIdx !== dragStartRef.current.idx || isDraggingRowsRef.current) {
          if (dy > 8 || currentIdx !== dragStartRef.current.idx) {
            isDraggingRowsRef.current = true;
            window.getSelection()?.removeAllRanges();
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            const start = Math.min(dragStartRef.current.idx, currentIdx);
            const end = Math.max(dragStartRef.current.idx, currentIdx);
            updateSelectionRange({ start, end });
          }
        }
      }
    };

    const handleMouseUp = () => {
      dragStartRef.current = null;
      isDraggingRowsRef.current = false;
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateSelectionRange]);

  // Global Keyboard Shortcuts (Capture Phase): Cmd+A, Backspace, Delete,
  // Type-to-replace, Cmd+C, Cmd+X, navigation & selection keys.
  // File & history shortcuts (Cmd+S/O/N/Z/Y) live in DocumentContext.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeRange = selectionRangeRef.current;

      const isInsideTitleInput =
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.getAttribute('placeholder') === 'Document Title';

      const ae = document.activeElement as HTMLElement | null;
      const editableEl =
        ae && ae.isContentEditable && ae.closest('[data-element-idx]') ? ae : null;
      const mathFieldEl =
        ae && ae.tagName.toLowerCase() === 'math-field' ? ae : null;

      // 1. Cmd+ArrowUp/Down & Cmd+Home/End: jump to document boundaries
      //    (with Shift: extend the element-range selection to that boundary)
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End')
      ) {
        if (isInsideTitleInput) return;
        e.preventDefault();
        e.stopPropagation();
        if (visibleElements.length === 0) return;
        const toStart = e.key === 'ArrowUp' || e.key === 'Home';
        const target = toStart ? visibleElements[0] : visibleElements[visibleElements.length - 1];

        if (e.shiftKey) {
          const curIdx = activeElementId
            ? doc.elements.findIndex((el) => el.id === activeElementId)
            : -1;
          const targetIdx = doc.elements.findIndex((el) => el.id === target.id);
          if (curIdx === -1 || targetIdx === -1 || curIdx === targetIdx) return;
          if (editableEl) editableEl.blur();
          else if (mathFieldEl) mathFieldEl.blur();
          window.getSelection()?.removeAllRanges();
          updateSelectionRange({
            start: Math.min(curIdx, targetIdx),
            end: Math.max(curIdx, targetIdx),
          });
          setActiveElementId(target.id);
          return;
        }

        updateSelectionRange(null);
        ensureFocusById(target.id, !toStart);
        return;
      }

      // 2. Cmd+A (or Ctrl+A): select line content first, then all elements
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'a') {
        if (isInsideTitleInput) return; // Allow native select-all in title input

        if (editableEl) {
          if (!selectionCoversAll(editableEl)) return; // native select-all within the line
        } else if (mathFieldEl) {
          try {
            const mf = mathFieldEl as any;
            const fullySelected =
              !mf.selectionIsCollapsed && (mf.position === 0 || mf.position === mf.lastOffset);
            if (!fullySelected) return; // let MathLive select-all within the field
          } catch {
            return;
          }
        }

        e.preventDefault();
        e.stopPropagation();

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        window.getSelection()?.removeAllRanges();
        updateSelectionRange({ start: 0, end: doc.elements.length - 1 });
        return;
      }

      // 3. Cmd+Alt+1/2/3: set heading level (converts text line, retunes section)
      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault();
        e.stopPropagation();
        const el = activeElementId ? doc.elements.find((x) => x.id === activeElementId) : undefined;
        if (!el || el.type === 'math') return;
        const level = parseInt(e.key, 10) as 1 | 2 | 3;
        const kinds = { 1: 'section', 2: 'subsection', 3: 'subsubsection' } as const;
        if (el.type === 'section') {
          updateElement(el.id, { level, kind: kinds[level] });
        } else {
          updateElement(el.id, {
            type: 'section',
            title: (el.content || '').replace(/<[^>]*>/g, ''),
            level,
            kind: kinds[level],
            collapsed: false,
          } as any);
          ensureFocusById(el.id, true);
        }
        return;
      }

      // 4. Backspace or Delete with active selectionRange
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (activeRange !== null) {
          e.preventDefault();
          e.stopPropagation();

          const { start, end } = activeRange;
          if (start === 0 && end >= doc.elements.length - 1) {
            // Delete entire document -> reset to 1 fresh element
            const newId = 'el-' + Date.now();
            const freshEl: DocumentElement =
              mode === 'text'
                ? { id: newId, type: 'text', content: '' }
                : { id: newId, type: 'math', input: '', evaluated: false };

            setElements([freshEl], newId);
            updateSelectionRange(null);
            setTimeout(() => focusElement(0, false), 40);
            return;
          } else {
            // Delete selected subset of lines
            const updated = [...doc.elements];
            updated.splice(start, end - start + 1);

            if (updated.length === 0) {
              const newId = 'el-' + Date.now();
              updated.push(
                mode === 'text'
                  ? { id: newId, type: 'text', content: '' }
                  : { id: newId, type: 'math', input: '', evaluated: false }
              );
            }

            const targetIdx = Math.max(0, Math.min(start, updated.length - 1));
            setElements(updated, updated[targetIdx].id);
            updateSelectionRange(null);
            setTimeout(() => focusElement(targetIdx, true), 40);
            return;
          }
        }
      }

      // 4. Typing any printable character when selectionRange is active -> replace selection
      if (
        activeRange !== null &&
        e.key.length === 1 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopPropagation();

        const { start, end } = activeRange;
        const updated = [...doc.elements];
        const newId = 'el-' + Date.now();
        const freshEl: DocumentElement =
          mode === 'text'
            ? { id: newId, type: 'text', content: e.key }
            : { id: newId, type: 'math', input: e.key, evaluated: false };

        updated.splice(start, end - start + 1, freshEl);
        setElements(updated, newId);
        updateSelectionRange(null);
        setTimeout(() => focusElement(start, true), 40);
        return;
      }

      // 5. Cmd+C (Copy) and Cmd+X (Cut) when selectionRange is active
      if ((e.metaKey || e.ctrlKey) && activeRange !== null) {
        const key = e.key.toLowerCase();
        if (key === 'c' || key === 'x') {
          e.preventDefault();
          e.stopPropagation();
          const selectedEls = doc.elements.slice(activeRange.start, activeRange.end + 1);
          const textContent = selectedEls
            .map((el) => {
              if (el.type === 'text') return el.content;
              if (el.type === 'section') return el.title;
              let s = el.input;
              if (el.evaluated && el.resultText) {
                s += '\n  => ' + el.resultText;
              }
              return s;
            })
            .join('\n\n');

          navigator.clipboard.writeText(textContent);

          if (key === 'x') {
            const { start, end } = activeRange;
            const updated = [...doc.elements];
            updated.splice(start, end - start + 1);

            if (updated.length === 0) {
              const newId = 'el-' + Date.now();
              updated.push(
                mode === 'text'
                  ? { id: newId, type: 'text', content: '' }
                  : { id: newId, type: 'math', input: '', evaluated: false }
              );
            }

            const targetIdx = Math.max(0, Math.min(start, updated.length - 1));
            setElements(updated, updated[targetIdx].id);
            updateSelectionRange(null);
            setTimeout(() => focusElement(targetIdx, true), 40);
          }
          return;
        }
      }

      // 6. Arrow keys when selectionRange is active -> collapse selection
      if (!e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        if (activeRange !== null) {
          e.preventDefault();
          e.stopPropagation();
          const targetIdx = e.key === 'ArrowUp' ? activeRange.start : activeRange.end;
          updateSelectionRange(null);
          focusElement(targetIdx, e.key === 'ArrowUp' ? false : true);
          return;
        }
      }

      // 7. Shift+Arrow keys to extend selection.
      // Inside a line, let the native editor extend the caret selection until it
      // reaches the first/last visual line; only then start element-range selection.
      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        if (mathFieldEl) return; // MathLive extends the selection inside the formula
        if (editableEl) {
          const atBoundary =
            e.key === 'ArrowUp' ? caretOnFirstLine(editableEl) : caretOnLastLine(editableEl);
          if (!atBoundary) return;
          editableEl.blur();
          window.getSelection()?.removeAllRanges();
        }
        e.preventDefault();
        e.stopPropagation();
        const currentActiveIdx = activeElementId
          ? doc.elements.findIndex((el) => el.id === activeElementId)
          : 0;

        if (activeRange === null) {
          if (e.key === 'ArrowDown' && currentActiveIdx < doc.elements.length - 1) {
            updateSelectionRange({ start: currentActiveIdx, end: currentActiveIdx + 1 });
            setActiveElementId(doc.elements[currentActiveIdx + 1].id);
          } else if (e.key === 'ArrowUp' && currentActiveIdx > 0) {
            updateSelectionRange({ start: currentActiveIdx - 1, end: currentActiveIdx });
            setActiveElementId(doc.elements[currentActiveIdx - 1].id);
          }
        } else {
          if (e.key === 'ArrowDown' && activeRange.end < doc.elements.length - 1) {
            updateSelectionRange({ start: activeRange.start, end: activeRange.end + 1 });
            setActiveElementId(doc.elements[activeRange.end + 1].id);
          } else if (e.key === 'ArrowUp' && activeRange.start > 0) {
            updateSelectionRange({ start: activeRange.start - 1, end: activeRange.end });
            setActiveElementId(doc.elements[activeRange.start - 1].id);
          }
        }
        return;
      }

      // 8. Escape to cancel selection
      if (e.key === 'Escape' && activeRange !== null) {
        e.preventDefault();
        e.stopPropagation();
        updateSelectionRange(null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [
    doc.elements,
    mode,
    setElements,
    updateSelectionRange,
    focusElement,
    activeElementId,
    setActiveElementId,
    visibleElements,
    ensureFocusById,
    updateElement,
  ]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] select-text h-full outline-none"
      tabIndex={-1}
      onClick={(e) => {
        // If clicking empty space at the bottom of the document, focus the last element
        if (e.target === containerRef.current && doc.elements.length > 0) {
          focusElement(doc.elements.length - 1, true);
        }
      }}
    >
      {/* Centered Document Page Sheet (8.5" US Letter Standard) */}
      <div
        className="min-w-full flex justify-center py-6 px-4"
        style={{
          minWidth: `${paperWidth * 96 * zoom + 48}px`,
        }}
      >
        <div
          style={{
            width: `${paperWidth * 96}px`,
            transform: zoom === 1 ? undefined : `scale(${zoom})`,
            transformOrigin: 'top center',
            marginBottom: zoom > 1 ? `${(zoom - 1) * 900}px` : undefined,
          }}
        >
          <div
            className="bg-white min-h-[11in] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] border border-[var(--border-color)]/60 text-[var(--text-primary)] select-text transition-all duration-75"
            style={{
              paddingLeft: `${pageMargins.left * 96}px`,
              paddingRight: `${pageMargins.right * 96}px`,
              paddingTop: '2.5rem',
              paddingBottom: '5rem',
            }}
          >
            {/* Document Title */}
            <div className="mb-6">
              <input
                ref={titleInputRef}
                type="text"
                value={doc.title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const first = visibleElements[0];
                    if (first) ensureFocusById(first.id, false);
                  }
                }}
                className="w-full text-2xl font-serif font-bold text-[var(--text-primary)] border-none outline-none bg-transparent p-0 placeholder:text-[var(--text-muted)] select-text"
                placeholder="Document Title"
              />
            </div>

            {/* Continuous Stream of Text & 2D Math */}
            <div ref={elementsContainerRef} className="select-text">
          {doc.elements.map((el, index) => {
            // If this element is inside a collapsed section, do not render it
            if (collapsedElementIds.has(el.id)) {
              return null;
            }

            const isActive = activeElementId === el.id;
            const isSelected =
              selectionRange !== null &&
              index >= selectionRange.start &&
              index <= selectionRange.end;

            const handleRowMouseDown = () => {
              if (selectionRangeRef.current !== null) {
                updateSelectionRange(null);
              }
            };

            // Section Element
            if (el.type === 'section') {
              const sec = el as SectionElement;
              const outlineItem = outlineMap.get(el.id);
              return (
                <React.Fragment key={el.id}>
                  <SectionLine
                    id={el.id}
                    index={index}
                    title={sec.title}
                    level={sec.level || 1}
                    kind={sec.kind || 'section'}
                    collapsed={Boolean(sec.collapsed)}
                    numberLabel={outlineItem?.numberLabel || '§'}
                    elementCount={outlineItem?.elementCount || 0}
                    isActive={isActive}
                    isSelected={isSelected}
                    onFocus={() => {
                      setActiveElementId(el.id);
                      setMode('section');
                    }}
                    onChangeTitle={(newTitle) => updateElement(el.id, { title: newTitle })}
                    onChangeLevel={(newLevel, newKind) =>
                      updateElement(el.id, { level: newLevel, kind: newKind })
                    }
                    onToggleCollapse={() => toggleSectionCollapse(el.id)}
                    onEnter={() => {
                      const newId = insertElement(mode === 'section' ? 'text' : mode, el.id);
                      ensureFocusById(newId, false);
                    }}
                    onBackspaceEmpty={() => {
                      if (doc.elements.length > 1) {
                        const pos = visibleElements.findIndex((e) => e.id === el.id);
                        const prev = pos > 0 ? visibleElements[pos - 1] : visibleElements[pos + 1];
                        deleteElement(el.id);
                        if (prev) ensureFocusById(prev.id, pos > 0);
                      } else {
                        convertElementType(el.id, 'text');
                        ensureFocusById(el.id, false);
                      }
                    }}
                    onNavigateUp={() => focusNeighborOf(el.id, -1)}
                    onNavigateDown={() => focusNeighborOf(el.id, 1)}
                    onRowMouseDown={handleRowMouseDown}
                    registerRef={(r) => {
                      if (r) sectionRefs.current.set(el.id, r);
                      else sectionRefs.current.delete(el.id);
                    }}
                  />
                  {sec.collapsed && (
                    <div
                      onClick={() => toggleSectionCollapse(el.id)}
                      className="my-1.5 ml-8 px-3 py-1.5 bg-blue-50/60 hover:bg-blue-100/60 border border-dashed border-blue-200/80 rounded text-xs text-slate-600 flex items-center gap-2 cursor-pointer transition-colors select-none group"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-[#242e84] group-hover:translate-x-0.5 transition-transform" />
                      <span className="font-semibold text-[#242e84]">
                        {outlineItem?.elementCount || 0} elements hidden in &ldquo;{sec.title || 'Untitled'}&rdquo;
                      </span>
                      <span className="text-slate-400">— click to expand</span>
                    </div>
                  )}
                </React.Fragment>
              );
            }

            if (el.type === 'text') {
              return (
                <TextLine
                  key={el.id}
                  id={el.id}
                  index={index}
                  content={el.content}
                  color={el.color}
                  backgroundColor={el.backgroundColor}
                  isActive={isActive}
                  isSelected={isSelected}
                  onFocus={() => {
                    setActiveElementId(el.id);
                    setMode('text');
                    if (textRefs.current.get(el.id)) {
                      activeInputRef.current = textRefs.current.get(el.id) as any;
                    }
                  }}
                  onChange={(text) => updateElement(el.id, { content: text })}
                  onConvertToSection={(lvl, knd, t) => {
                    updateElement(el.id, {
                      type: 'section',
                      title: t || '',
                      level: lvl,
                      kind: knd || 'section',
                      collapsed: false,
                    } as any);
                    ensureFocusById(el.id, true);
                  }}
                  onSplit={(head, tail) => {
                    updateElement(el.id, { content: head });
                    const newId = insertElement('text', el.id);
                    updateElement(newId, { content: tail });
                    ensureFocusById(newId, false);
                  }}
                  onInsertBelow={() => {
                    const newId = insertElement('text', el.id);
                    ensureFocusById(newId, false);
                  }}
                  onBackspaceEmpty={() => {
                    if (doc.elements.length > 1) {
                      const pos = visibleElements.findIndex((e) => e.id === el.id);
                      const prev = pos > 0 ? visibleElements[pos - 1] : visibleElements[pos + 1];
                      deleteElement(el.id);
                      if (prev) ensureFocusById(prev.id, pos > 0);
                    }
                  }}
                  onBackspaceAtStart={() => {
                    const pos = visibleElements.findIndex((e) => e.id === el.id);
                    const prev = pos > 0 ? visibleElements[pos - 1] : undefined;
                    if (!prev) return;
                    if (prev.type === 'text') {
                      const junction = htmlTextLength(prev.content || '');
                      // Queue the focus request so the caret lands at the merge
                      // junction only after React has committed the merged HTML.
                      pendingFocusIdRef.current = { id: prev.id, atEnd: false, offset: junction };
                      updateElement(prev.id, { content: (prev.content || '') + el.content });
                      deleteElement(el.id);
                      setActiveElementId(prev.id);
                    } else {
                      ensureFocusById(prev.id, true);
                    }
                  }}
                  onDeleteAtEnd={() => {
                    const pos = visibleElements.findIndex((e) => e.id === el.id);
                    const next = pos !== -1 ? visibleElements[pos + 1] : undefined;
                    if (!next) return;
                    if (next.type === 'text') {
                      const junction = htmlTextLength(el.content || '');
                      pendingFocusIdRef.current = { id: el.id, atEnd: false, offset: junction };
                      updateElement(el.id, {
                        content: (el.content || '') + (next as TextElement).content,
                      });
                      deleteElement(next.id);
                      setActiveElementId(el.id);
                    } else {
                      ensureFocusById(next.id, false);
                    }
                  }}
                  onNavigateUp={() => focusNeighborOf(el.id, -1)}
                  onNavigateDown={() => focusNeighborOf(el.id, 1)}
                  onRowMouseDown={handleRowMouseDown}
                  registerRef={(r) => {
                    if (r) textRefs.current.set(el.id, r);
                    else textRefs.current.delete(el.id);
                  }}
                />
              );
            }

            // 2D Math Field
            return (
              <MathLine
                key={el.id}
                id={el.id}
                index={index}
                input={el.input}
                evaluated={el.evaluated}
                resultLatex={el.resultLatex}
                resultText={el.resultText}
                resultPlotSvg={el.resultPlotSvg}
                resultType={el.resultType}
                error={el.error}
                errorCol={el.errorCol}
                errorSource={el.errorSource}
                isEvaluating={el.isEvaluating}
                color={el.color}
                backgroundColor={el.backgroundColor}
                isActive={isActive}
                isSelected={isSelected}
                onFocus={() => {
                  setActiveElementId(el.id);
                  setMode('math');
                }}
                onChange={(latex) => updateElement(el.id, { input: latex })}
                onEvaluate={() => {
                  if (el.input && el.input.trim() !== '') {
                    evaluateMath(el.id);
                  }
                  const pos = visibleElements.findIndex((e) => e.id === el.id);
                  const next = pos !== -1 ? visibleElements[pos + 1] : undefined;
                  if (next) {
                    ensureFocusById(next.id, false);
                  } else {
                    const newId = insertElement(mode, el.id);
                    ensureFocusById(newId, false);
                  }
                }}
                onEvaluateInPlace={() => {
                  if (el.input && el.input.trim() !== '') {
                    evaluateMath(el.id);
                  }
                }}
                onInsertBelow={() => {
                  const newId = insertElement('math', el.id);
                  ensureFocusById(newId, false);
                }}
                onUnevaluate={() => unevaluateMath(el.id)}
                onDeleteEmpty={() => {
                  if (doc.elements.length > 1) {
                    const pos = visibleElements.findIndex((e) => e.id === el.id);
                    const prev = pos > 0 ? visibleElements[pos - 1] : visibleElements[pos + 1];
                    deleteElement(el.id);
                    if (prev) ensureFocusById(prev.id, pos > 0);
                  } else {
                    convertElementType(el.id, 'text');
                    ensureFocusById(el.id, false);
                  }
                }}
                onBackspaceAtStart={() => focusNeighborOf(el.id, -1)}
                onDeleteAtEnd={() => focusNeighborOf(el.id, 1)}
                onNavigateUp={() => focusNeighborOf(el.id, -1)}
                onNavigateDown={() => focusNeighborOf(el.id, 1)}
                onRowMouseDown={handleRowMouseDown}
                registerRef={(h) => {
                  if (h) mathRefs.current.set(el.id, h);
                  else mathRefs.current.delete(el.id);
                }}
              />
            );
          })}
        </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MapleDocument = MathDocument;
export default MathDocument;
