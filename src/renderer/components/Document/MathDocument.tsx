import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useDocument } from '../../context/DocumentContext';
import { MathField, MathFieldHandle } from '../MathEditor/MathField';
import { KaTeXRenderer } from '../Worksheet/KaTeXRenderer';
import { DocumentElement, ElementType, SectionElement, SectionKind } from '../../../types/document';
import { computeOutline, getCollapsedElementIds, OutlineItem } from '../../utils/outline';
import { SectionLine } from './SectionLine';
import { ChevronRight } from 'lucide-react';

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
  onEnter: () => void;
  onBackspaceEmpty: () => void;
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
  onEnter,
  onBackspaceEmpty,
  onNavigateUp,
  onNavigateDown,
  onRowMouseDown,
  registerRef,
}) => {
  const elRef = useRef<HTMLDivElement | null>(null);

  // Synchronize text from state only when this element is NOT actively being typed into
  useEffect(() => {
    if (elRef.current && document.activeElement !== elRef.current) {
      if (elRef.current.innerHTML !== content) {
        elRef.current.innerHTML = content;
      }
    }
  }, [content]);

  // Set initial content on mount
  useEffect(() => {
    if (elRef.current) {
      elRef.current.innerHTML = content;
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
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onEnter();
            } else if (e.key === 'Backspace') {
              const text = e.currentTarget.innerText.trim();
              if (text === '') {
                e.preventDefault();
                onBackspaceEmpty();
              }
            } else if (e.key === 'ArrowUp') {
              const sel = window.getSelection();
              let isAtTop = true;
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const containerRect = e.currentTarget.getBoundingClientRect();
                if (rect.top > 0 && containerRect.top > 0 && rect.top - containerRect.top > 16) {
                  isAtTop = false;
                }
              }
              if (isAtTop) {
                e.preventDefault();
                onNavigateUp();
              }
            } else if (e.key === 'ArrowDown') {
              const sel = window.getSelection();
              let isAtBottom = true;
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const containerRect = e.currentTarget.getBoundingClientRect();
                if (rect.bottom > 0 && containerRect.bottom > 0 && containerRect.bottom - rect.bottom > 16) {
                  isAtBottom = false;
                }
              }
              if (isAtBottom) {
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
  isEvaluating?: boolean;
  color?: string;
  backgroundColor?: string;
  isActive: boolean;
  isSelected: boolean;
  onFocus: () => void;
  onChange: (newContent: string) => void;
  onEvaluate: () => void;
  onDeleteEmpty: () => void;
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
  isEvaluating,
  color,
  backgroundColor,
  isActive,
  isSelected,
  onFocus,
  onChange,
  onEvaluate,
  onDeleteEmpty,
  onNavigateUp,
  onNavigateDown,
  onRowMouseDown,
  registerRef,
}) => {
  const mfHandleRef = useRef<MathFieldHandle | null>(null);

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
          onDelete={onDeleteEmpty}
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
        <div className="py-0.5 pl-6 text-red-600 text-xs font-mono select-text">
          {error}
        </div>
      ) : evaluated && (resultPlotSvg || resultType === 'plot') ? (
        <div className="py-1.5 pl-6 select-text">
          <div className="relative group/plot inline-block w-full max-w-[560px] rounded border border-slate-200 bg-white p-2 shadow-xs transition-shadow hover:shadow-sm">
            <div
              className="w-full h-auto overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
              dangerouslySetInnerHTML={{ __html: resultPlotSvg || '' }}
            />
            {/* Quick Action to copy SVG code */}
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
            </div>
          </div>
        </div>
      ) : evaluated && resultLatex ? (
        <div className="pt-0.5 pb-0.5 pl-6 select-text" style={color ? { color } : undefined}>
          <KaTeXRenderer
            math={resultLatex}
            displayMode={false}
            className="select-text inline-block"
          />
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
    activeInputRef,
    saveDocument,
    openDocument,
    newDocument,
    pageMargins,
    paperWidth,
  } = useDocument();

  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const elementsContainerRef = useRef<HTMLDivElement | null>(null);
  const textRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const mathRefs = useRef<Map<string, MathFieldHandle>>(new Map());
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Focus and conversion tracking
  const pendingFocusIdRef = useRef<{ id: string; atEnd: boolean } | null>(null);
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

  const updateSelectionRange = useCallback((range: SelectionRange | null) => {
    selectionRangeRef.current = range;
    setSelectionRange(range);
  }, []);

  // Directly attempt to focus an element by ID via handles or DOM
  const focusElementById = useCallback((id: string, atEnd = false): boolean => {
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
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(secEl);
          range.collapse(!atEnd);
          sel.removeAllRanges();
          sel.addRange(range);
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
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(textEl);
          range.collapse(!atEnd);
          sel.removeAllRanges();
          sel.addRange(range);
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
  const ensureFocusById = useCallback((id: string, atEnd = false, attempts = 20) => {
    pendingFocusIdRef.current = { id, atEnd };
    setActiveElementId(id);

    const tryFocus = (remaining: number) => {
      if (pendingFocusIdRef.current?.id !== id) return;

      if (focusElementById(id, atEnd)) {
        pendingFocusIdRef.current = null;
        return;
      }

      if (remaining > 0) {
        requestAnimationFrame(() => tryFocus(remaining - 1));
      }
    };

    tryFocus(attempts);
  }, [focusElementById, setActiveElementId]);

  // Focus an element by index
  const focusElement = useCallback((index: number, atEnd = false) => {
    if (doc.elements.length === 0) return;
    const clamped = Math.max(0, Math.min(index, doc.elements.length - 1));
    const target = doc.elements[clamped];
    if (target) {
      ensureFocusById(target.id, atEnd);
    }
  }, [doc.elements, ensureFocusById]);

  // React to document element changes: fulfill pending focus & auto-focus converted lines
  useEffect(() => {
    if (pendingFocusIdRef.current) {
      const { id, atEnd } = pendingFocusIdRef.current;
      ensureFocusById(id, atEnd);
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
  }, [doc.elements, ensureFocusById]);

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
      const currentEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const currentRow = currentEl?.closest?.('[data-element-idx]') as HTMLElement | null;

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

  // Global Keyboard Shortcuts (Capture Phase): Cmd+S, Cmd+O, Cmd+N, Cmd+A, Backspace, Delete, Type-to-replace, Cmd+C, Cmd+X, Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeRange = selectionRangeRef.current;

      const isInsideTitleInput =
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.getAttribute('placeholder') === 'Document Title';

      // 1. File shortcuts: Cmd+S, Cmd+Shift+S, Cmd+O, Cmd+N
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 's') {
          e.preventDefault();
          e.stopPropagation();
          saveDocument(e.shiftKey);
          return;
        }
        if (key === 'o' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          openDocument();
          return;
        }
        if (key === 'n' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          newDocument();
          return;
        }
      }

      // 2. Cmd+A (or Ctrl+A): Select All lines across the document
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        if (isInsideTitleInput) return; // Allow native select-all in title input

        e.preventDefault();
        e.stopPropagation();

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        window.getSelection()?.removeAllRanges();
        updateSelectionRange({ start: 0, end: doc.elements.length - 1 });
        return;
      }

      // 3. Backspace or Delete with active selectionRange
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

      // 7. Shift+Arrow keys to extend selection
      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
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
    saveDocument,
    openDocument,
    newDocument,
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
                type="text"
                value={doc.title}
                onChange={(e) => setTitle(e.target.value)}
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
                        const prevIdx = Math.max(0, index - 1);
                        const prevId = doc.elements[prevIdx]?.id;
                        deleteElement(el.id);
                        if (prevId) ensureFocusById(prevId, true);
                      } else {
                        convertElementType(el.id, 'text');
                        ensureFocusById(el.id, false);
                      }
                    }}
                    onNavigateUp={() => {
                      if (index > 0) {
                        const prevId = doc.elements[index - 1]?.id;
                        if (prevId) ensureFocusById(prevId, true);
                      }
                    }}
                    onNavigateDown={() => {
                      if (index < doc.elements.length - 1) {
                        const nextId = doc.elements[index + 1]?.id;
                        if (nextId) ensureFocusById(nextId, false);
                      }
                    }}
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
                  onEnter={() => {
                    const newId = insertElement(mode, el.id);
                    ensureFocusById(newId, false);
                  }}
                  onBackspaceEmpty={() => {
                    if (doc.elements.length > 1) {
                      const prevIdx = Math.max(0, index - 1);
                      const prevId = doc.elements[prevIdx]?.id;
                      deleteElement(el.id);
                      if (prevId) {
                        ensureFocusById(prevId, true);
                      }
                    }
                  }}
                  onNavigateUp={() => {
                    if (index > 0) {
                      const prevId = doc.elements[index - 1]?.id;
                      if (prevId) ensureFocusById(prevId, true);
                    }
                  }}
                  onNavigateDown={() => {
                    if (index < doc.elements.length - 1) {
                      const nextId = doc.elements[index + 1]?.id;
                      if (nextId) ensureFocusById(nextId, false);
                    }
                  }}
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
                  const newId = insertElement(mode, el.id);
                  ensureFocusById(newId, false);
                }}
                onDeleteEmpty={() => {
                  if (doc.elements.length > 1) {
                    const prevIdx = Math.max(0, index - 1);
                    const prevId = doc.elements[prevIdx]?.id;
                    deleteElement(el.id);
                    if (prevId) {
                      ensureFocusById(prevId, true);
                    }
                  } else {
                    convertElementType(el.id, 'text');
                    ensureFocusById(el.id, false);
                  }
                }}
                onNavigateUp={() => {
                  if (index > 0) {
                    const prevId = doc.elements[index - 1]?.id;
                    if (prevId) ensureFocusById(prevId, true);
                  }
                }}
                onNavigateDown={() => {
                  if (index < doc.elements.length - 1) {
                    const nextId = doc.elements[index + 1]?.id;
                    if (nextId) ensureFocusById(nextId, false);
                  }
                }}
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
