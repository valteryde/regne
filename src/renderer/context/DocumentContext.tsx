import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import {
  RegneDocument,
  DocumentElement,
  TextElement,
  MathElement,
  SectionElement,
  SectionKind,
  ElementType,
} from '../../types/document';
import { useEngine } from './EngineContext';

interface DocumentContextValue {
  document: RegneDocument;
  activeElementId: string | null;
  mode: ElementType;
  zoom: number;
  filePath: string | null;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  activeInputRef: React.MutableRefObject<HTMLTextAreaElement | HTMLInputElement | null>;

  isRulerVisible: boolean;
  rulerPosition: 'top' | 'bottom';
  pageMargins: { left: number; right: number };
  paperWidth: number;
  setRulerVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  toggleRuler: () => void;
  setRulerPosition: (pos: 'top' | 'bottom') => void;
  setPageMargins: (margins: { left: number; right: number } | ((prev: { left: number; right: number }) => { left: number; right: number })) => void;

  setMode: (mode: ElementType) => void;
  toggleMode: () => void;
  setTitle: (title: string) => void;
  setActiveElementId: (id: string | null) => void;
  updateElement: (id: string, updates: Partial<DocumentElement>) => void;
  convertElementType: (id: string, newType: ElementType) => void;
  insertElement: (type: ElementType, afterId?: string) => string;
  insertSection: (level?: 1 | 2 | 3, afterId?: string, kind?: SectionKind, title?: string) => string;
  toggleSectionCollapse: (id: string) => void;
  scrollToElement: (id: string) => void;
  deleteElement: (id: string) => void;
  setElements: (elements: DocumentElement[], newActiveId?: string) => void;
  
  evaluateMath: (id: string) => Promise<void>;
  evaluateAll: () => Promise<void>;
  unevaluateMath: (id: string) => void;
  unevaluateAll: () => void;
  
  insertAtCursor: (snippet: string) => void;
  insertMatrix: (rows: number, cols: number, bracketType?: 'pmatrix' | 'bmatrix' | 'vmatrix' | 'matrix') => void;
  insertRawTeX: (latex: string) => void;
  
  newDocument: () => void;
  saveDocument: (saveAs?: boolean) => Promise<boolean>;
  openDocument: () => Promise<boolean>;
  exportDocument: (type: 'tex' | 'html') => Promise<boolean>;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  undo: () => void;
  redo: () => void;
  focusRequest: { id: string; atEnd: boolean; offset?: number; nonce: number } | null;
  requestElementFocus: (id: string, opts?: { atEnd?: boolean; offset?: number }) => void;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

function createInitialDocument(): RegneDocument {
  return {
    id: 'doc-' + Date.now(),
    title: 'Untitled Document',
    version: '1.0.0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    elements: [
      {
        id: 'sec-1',
        type: 'section',
        title: 'Introduction',
        level: 1,
        kind: 'section',
        collapsed: false,
      },
      {
        id: 'el-1',
        type: 'text',
        content: 'Regne is a document-style mathematical environment inspired by Maple Document Mode. Math expressions and explanatory text flow together as a single continuous document, without notebook cell boundaries or left brackets.',
      },
      {
        id: 'sec-2',
        type: 'section',
        title: 'Curvature Invariants',
        level: 1,
        kind: 'section',
        collapsed: false,
      },
      {
        id: 'sec-2-1',
        type: 'section',
        title: 'Differential Derivatives',
        level: 2,
        kind: 'theorem',
        collapsed: false,
      },
      {
        id: 'el-2',
        type: 'text',
        content: 'To evaluate any math expression, press Enter on the math line. The symbolic result appears directly below in typeset blue notation.',
      },
      {
        id: 'el-3',
        type: 'math',
        input: '\\frac{d}{dx}\\left(\\sin\\left(x\\right)\\right)',
        evaluated: true,
        resultLatex: '\\cos\\left(x\\right)',
        resultText: 'cos(x)',
      },
      {
        id: 'sec-2-2',
        type: 'section',
        title: 'Analytic Integration',
        level: 2,
        kind: 'lemma',
        collapsed: false,
      },
      {
        id: 'el-4',
        type: 'text',
        content: 'We can also integrate functions analytically:',
      },
      {
        id: 'el-5',
        type: 'math',
        input: '\\int x^{2}\\, dx',
        evaluated: true,
        resultLatex: '\\frac{1}{3} x^{3} + C',
        resultText: '1/3*x^3 + C',
      },
      {
        id: 'sec-3',
        type: 'section',
        title: 'Geodesic Flows',
        level: 1,
        kind: 'section',
        collapsed: false,
      },
      {
        id: 'el-6',
        type: 'text',
        content: 'Algebraic polynomials can be factored or expanded directly within the document flow:',
      },
      {
        id: 'el-7',
        type: 'math',
        input: '\\left(x+1\\right)^{3}',
        evaluated: true,
        resultLatex: 'x^{3} + 3x^{2} + 3x + 1',
        resultText: 'x^3 + 3*x^2 + 3*x + 1',
      },
      {
        id: 'el-8',
        type: 'math',
        input: 'x^{2} - 4 = 0',
        evaluated: true,
        resultLatex: '\\left\\{ x = -2, \\; x = 2 \\right\\}',
        resultText: '{x = -2, x = 2}',
      },
      {
        id: 'sec-4',
        type: 'section',
        title: 'Concluding Remarks',
        level: 1,
        kind: 'section',
        collapsed: false,
      },
      {
        id: 'el-9',
        type: 'text',
        content: 'Variables and constants are bound into the active session using the assignment operator :=',
      },
      {
        id: 'el-10',
        type: 'math',
        input: 'radius := 5',
        evaluated: true,
        resultLatex: 'radius := 5',
        resultText: 'radius := 5',
      },
    ],
  };
}

function loadLastSession(): {
  doc: RegneDocument;
  filePath: string | null;
  activeId: string | null;
  zoom: number;
} {
  try {
    const savedDoc = localStorage.getItem('regne:last-doc') || localStorage.getItem('hypatia:last-doc');
    const savedPath = localStorage.getItem('regne:last-file-path') || localStorage.getItem('hypatia:last-file-path') || null;
    const savedActiveId = localStorage.getItem('regne:active-element-id') || localStorage.getItem('hypatia:active-element-id') || null;
    const savedZoom = parseFloat(localStorage.getItem('regne:zoom') || localStorage.getItem('hypatia:zoom') || '1.0');

    if (savedDoc) {
      const parsed = JSON.parse(savedDoc) as RegneDocument;
      if (parsed && Array.isArray(parsed.elements) && parsed.elements.length > 0) {
        return {
          doc: parsed,
          filePath: savedPath,
          activeId: savedActiveId || parsed.elements[0].id,
          zoom: isNaN(savedZoom) ? 1.0 : savedZoom,
        };
      }
    }
  } catch (err) {
    console.warn('Could not restore last session:', err);
  }

  const initial = createInitialDocument();
  return {
    doc: initial,
    filePath: null,
    activeId: initial.elements[0]?.id || null,
    zoom: 1.0,
  };
}

export const DocumentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { evaluate, reset: resetEngine } = useEngine();
  const [initialSession] = useState(loadLastSession);
  const [doc, setDoc] = useState<RegneDocument>(initialSession.doc);
  const [activeElementId, setActiveElementId] = useState<string | null>(initialSession.activeId);
  const [mode, setMode] = useState<ElementType>('math');
  const [zoom, setZoom] = useState<number>(initialSession.zoom);
  const [filePath, setFilePath] = useState<string | null>(initialSession.filePath);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [focusRequest, setFocusRequest] = useState<{
    id: string;
    atEnd: boolean;
    offset?: number;
    nonce: number;
  } | null>(null);

  const requestElementFocus = useCallback(
    (id: string, opts?: { atEnd?: boolean; offset?: number }) => {
      setFocusRequest({
        id,
        atEnd: opts?.atEnd ?? false,
        offset: opts?.offset,
        nonce: Date.now() + Math.random(),
      });
    },
    []
  );

  // Ruler & Page Margin States
  const [isRulerVisible, setIsRulerVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('regne:ruler-visible');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [rulerPosition, setRulerPosition] = useState<'top' | 'bottom'>(() => {
    try {
      const saved = localStorage.getItem('regne:ruler-position');
      return saved === 'bottom' ? 'bottom' : 'top';
    } catch {
      return 'top';
    }
  });

  const [pageMargins, setPageMargins] = useState<{ left: number; right: number }>(() => {
    try {
      const saved = localStorage.getItem('regne:page-margins');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.left === 'number' && typeof parsed.right === 'number') {
          return parsed;
        }
      }
    } catch {}
    return { left: 1.0, right: 1.0 };
  });

  const paperWidth = 8.5; // US Letter standard width (inches)

  const toggleRuler = useCallback(() => {
    setIsRulerVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('regne:ruler-visible', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleSetRulerVisible = useCallback((visible: boolean | ((prev: boolean) => boolean)) => {
    setIsRulerVisible((prev) => {
      const next = typeof visible === 'function' ? visible(prev) : visible;
      try {
        localStorage.setItem('regne:ruler-visible', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleSetRulerPosition = useCallback((pos: 'top' | 'bottom') => {
    setRulerPosition(pos);
    try {
      localStorage.setItem('regne:ruler-position', pos);
    } catch {}
  }, []);

  const handleSetPageMargins = useCallback((margins: { left: number; right: number } | ((prev: { left: number; right: number }) => { left: number; right: number })) => {
    setPageMargins((prev) => {
      const next = typeof margins === 'function' ? margins(prev) : margins;
      try {
        localStorage.setItem('regne:page-margins', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  
  const activeInputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  // If the last session was associated with a file on disk, verify and reload latest content from disk
  useEffect(() => {
    const api = window.regneAPI || window.hypatiaAPI;
    if (initialSession.filePath && api?.readFile) {
      api.readFile(initialSession.filePath).then((res) => {
        if (res.success && res.content) {
          try {
            const diskDoc = JSON.parse(res.content) as RegneDocument;
            if (diskDoc && Array.isArray(diskDoc.elements)) {
              setDoc(diskDoc);
              docRef.current = diskDoc;
              historyRef.current = [{ doc: JSON.parse(JSON.stringify(diskDoc)), activeElementId: diskDoc.elements[0]?.id || null }];
              historyIdxRef.current = 0;
              setCanUndo(false);
              setCanRedo(false);
              setIsDirty(false);
            }
          } catch {
            // Keep localStorage fallback
          }
        }
      });
    }
  }, [initialSession.filePath]);

  // Debounced auto-save of current session to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('regne:last-doc', JSON.stringify(doc));
        localStorage.setItem('regne:last-file-path', filePath || '');
        localStorage.setItem('regne:active-element-id', activeElementId || '');
        localStorage.setItem('regne:zoom', zoom.toString());
      } catch {
        // ignore storage errors
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [doc, filePath, activeElementId, zoom]);

  interface HistorySnapshot {
    doc: RegneDocument;
    activeElementId: string | null;
  }

  const docRef = useRef<RegneDocument>(initialSession.doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const activeElementIdRef = useRef<string | null>(initialSession.activeId);
  useEffect(() => {
    activeElementIdRef.current = activeElementId;
  }, [activeElementId]);

  const historyRef = useRef<HistorySnapshot[]>([
    {
      doc: JSON.parse(JSON.stringify(initialSession.doc)),
      activeElementId: initialSession.activeId,
    },
  ]);
  const historyIdxRef = useRef<number>(0);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  const updateCanUndoRedo = useCallback(() => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, []);

  const recordSnapshot = useCallback((newDoc?: RegneDocument, targetActiveId?: string | null) => {
    const docToRecord = newDoc || docRef.current;
    const activeIdToRecord = targetActiveId !== undefined ? targetActiveId : activeElementIdRef.current;
    const snap: HistorySnapshot = {
      doc: JSON.parse(JSON.stringify(docToRecord)),
      activeElementId: activeIdToRecord,
    };

    const trimmed = historyRef.current.slice(0, historyIdxRef.current + 1);
    trimmed.push(snap);

    if (trimmed.length > 150) {
      trimmed.shift();
    }

    historyRef.current = trimmed;
    historyIdxRef.current = trimmed.length - 1;
    updateCanUndoRedo();
    setIsDirty(true);
  }, [updateCanUndoRedo]);

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingInfoRef = useRef<{
    elementId: string;
    field: string;
    value: string;
    isDeleting: boolean;
    lastCheckpointTime: number;
  } | null>(null);

  const flushTypingCheckpoint = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    const currentSnap = historyRef.current[historyIdxRef.current];
    if (currentSnap) {
      const currentDocStr = JSON.stringify(docRef.current);
      const snapDocStr = JSON.stringify(currentSnap.doc);
      if (currentDocStr !== snapDocStr) {
        recordSnapshot(docRef.current, activeElementIdRef.current);
      }
    }
    lastTypingInfoRef.current = null;
  }, [recordSnapshot]);

  const undo = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const currentHead = historyRef.current[historyIdxRef.current];
    if (currentHead && JSON.stringify(docRef.current) !== JSON.stringify(currentHead.doc)) {
      const trimmed = historyRef.current.slice(0, historyIdxRef.current + 1);
      trimmed.push({
        doc: JSON.parse(JSON.stringify(docRef.current)),
        activeElementId: activeElementIdRef.current,
      });
      historyRef.current = trimmed;
      historyIdxRef.current = trimmed.length - 1;
    }

    lastTypingInfoRef.current = null;

    if (historyIdxRef.current > 0) {
      historyIdxRef.current -= 1;
      const targetSnapshot = historyRef.current[historyIdxRef.current];
      const targetDoc = JSON.parse(JSON.stringify(targetSnapshot.doc)) as RegneDocument;
      docRef.current = targetDoc;
      setDoc(targetDoc);

      if (targetSnapshot.activeElementId) {
        setActiveElementId(targetSnapshot.activeElementId);
        activeElementIdRef.current = targetSnapshot.activeElementId;
      }

      updateCanUndoRedo();
      setIsDirty(true);
    }
  }, [updateCanUndoRedo]);

  const redo = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    lastTypingInfoRef.current = null;

    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current += 1;
      const targetSnapshot = historyRef.current[historyIdxRef.current];
      const targetDoc = JSON.parse(JSON.stringify(targetSnapshot.doc)) as RegneDocument;
      docRef.current = targetDoc;
      setDoc(targetDoc);

      if (targetSnapshot.activeElementId) {
        setActiveElementId(targetSnapshot.activeElementId);
        activeElementIdRef.current = targetSnapshot.activeElementId;
      }

      updateCanUndoRedo();
      setIsDirty(true);
    }
  }, [updateCanUndoRedo]);

  const convertElementType = useCallback((id: string, newType: ElementType) => {
    flushTypingCheckpoint();
    setDoc((prev) => {
      const elements = prev.elements.map((el) => {
        if (el.id !== id || el.type === newType) return el;
        const existingColor = (el as any).color;
        const existingBgColor = (el as any).backgroundColor;
        if (newType === 'text') {
          const content = el.type === 'math' ? el.input || '' : (el as SectionElement).title || '';
          return {
            id: el.id,
            type: 'text',
            content,
            color: existingColor,
            backgroundColor: existingBgColor,
          } as DocumentElement;
        } else if (newType === 'math') {
          const rawText = el.type === 'text' ? (el.content || '').replace(/<[^>]*>/g, '') : (el as SectionElement).title || '';
          return {
            id: el.id,
            type: 'math',
            input: rawText,
            evaluated: false,
            color: existingColor,
            backgroundColor: existingBgColor,
          } as DocumentElement;
        } else {
          const title = el.type === 'text' ? (el.content || '').replace(/<[^>]*>/g, '') : (el as MathElement).input || '';
          return {
            id: el.id,
            type: 'section',
            title,
            level: 1,
            kind: 'section',
            collapsed: false,
          } as DocumentElement;
        }
      });
      const updated = { ...prev, elements, updatedAt: Date.now() };
      docRef.current = updated;
      recordSnapshot(updated, id);
      return updated;
    });
    setIsDirty(true);
    setMode(newType);
    setActiveElementId(id);
    activeElementIdRef.current = id;
  }, [flushTypingCheckpoint, recordSnapshot]);

  const toggleMode = useCallback(() => {
    const nextMode: ElementType = mode === 'text' ? 'math' : 'text';
    if (activeElementId) {
      const currentEl = doc.elements.find((e) => e.id === activeElementId);
      if (currentEl && (currentEl.type === 'text' || currentEl.type === 'math')) {
        convertElementType(activeElementId, currentEl.type === 'text' ? 'math' : 'text');
        return;
      }
    }
    // Section elements (or nothing focused) are never converted by F5 —
    // it only flips the mode used for newly inserted lines.
    setMode(nextMode);
  }, [mode, activeElementId, doc.elements, convertElementType]);

  const setTitle = useCallback((title: string) => {
    setDoc((prev) => {
      const updated = { ...prev, title, updatedAt: Date.now() };
      docRef.current = updated;
      return updated;
    });
    setIsDirty(true);

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      flushTypingCheckpoint();
    }, 400);
  }, [flushTypingCheckpoint]);

  const updateElement = useCallback((id: string, updates: Partial<DocumentElement>) => {
    const isEvaluatingOnly = updates.isEvaluating === true && Object.keys(updates).length === 1;

    setDoc((prev) => {
      const elements = prev.elements.map((el) => {
        if (el.id === id) {
          return { ...el, ...updates } as DocumentElement;
        }
        return el;
      });
      const updated = { ...prev, elements, updatedAt: Date.now() };
      docRef.current = updated;
      return updated;
    });
    setIsDirty(true);

    if (isEvaluatingOnly) {
      return;
    }

    const isTyping =
      'input' in updates ||
      'content' in updates ||
      'title' in updates;

    if (!isTyping) {
      flushTypingCheckpoint();
      recordSnapshot(undefined, id);
      return;
    }

    const field = 'input' in updates ? 'input' : 'content' in updates ? 'content' : 'title';
    const value = String((updates as any)[field] ?? '');

    const prevInfo = lastTypingInfoRef.current;
    const now = Date.now();

    if (prevInfo && (prevInfo.elementId !== id || prevInfo.field !== field)) {
      flushTypingCheckpoint();
    }

    const prevValue = prevInfo ? prevInfo.value : '';
    const isDeleting = value.length < prevValue.length;

    if (prevInfo && prevInfo.isDeleting !== isDeleting && prevValue !== value) {
      flushTypingCheckpoint();
    }

    let isBoundary = false;
    if (field === 'input') {
      const lastChar = value.slice(-1);
      isBoundary = /[+\-*\/=^()_,\s\\]/.test(lastChar);
    } else {
      const lastChar = value.slice(-1);
      isBoundary = /[\s.,!?;:\n]/.test(lastChar);
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const timeSinceLastCheckpoint = prevInfo ? now - prevInfo.lastCheckpointTime : 0;
    const charDiff = Math.abs(value.length - (prevInfo ? prevInfo.value.length : 0));

    if (isBoundary && (timeSinceLastCheckpoint > 250 || charDiff >= 2)) {
      recordSnapshot(undefined, id);
      lastTypingInfoRef.current = {
        elementId: id,
        field,
        value,
        isDeleting,
        lastCheckpointTime: now,
      };
    } else {
      lastTypingInfoRef.current = {
        elementId: id,
        field,
        value,
        isDeleting,
        lastCheckpointTime: prevInfo ? prevInfo.lastCheckpointTime : now,
      };

      typingTimerRef.current = setTimeout(() => {
        flushTypingCheckpoint();
      }, 400);
    }
  }, [flushTypingCheckpoint, recordSnapshot]);

  const insertElement = useCallback((type: ElementType, afterId?: string): string => {
    flushTypingCheckpoint();
    const newId = (type === 'section' ? 'sec-' : 'el-') + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    let newEl: DocumentElement;
    if (type === 'text') {
      newEl = { id: newId, type: 'text', content: '' };
    } else if (type === 'math') {
      newEl = { id: newId, type: 'math', input: '', evaluated: false };
    } else {
      newEl = { id: newId, type: 'section', title: '', level: 1, kind: 'section', collapsed: false };
    }

    setDoc((prev) => {
      const elements = [...prev.elements];
      if (!afterId) {
        elements.push(newEl);
      } else {
        const idx = elements.findIndex((e) => e.id === afterId);
        if (idx !== -1) {
          elements.splice(idx + 1, 0, newEl);
        } else {
          elements.push(newEl);
        }
      }
      const updated = { ...prev, elements, updatedAt: Date.now() };
      docRef.current = updated;
      recordSnapshot(updated, newId);
      return updated;
    });

    setActiveElementId(newId);
    activeElementIdRef.current = newId;
    return newId;
  }, [flushTypingCheckpoint, recordSnapshot]);

  const insertSection = useCallback((level: 1 | 2 | 3 = 1, afterId?: string, kind: SectionKind = 'section', title = ''): string => {
    flushTypingCheckpoint();
    const newId = 'sec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newEl: SectionElement = {
      id: newId,
      type: 'section',
      title,
      level,
      kind,
      collapsed: false,
    };

    setDoc((prev) => {
      const elements = [...prev.elements];
      if (!afterId) {
        elements.push(newEl);
      } else {
        const idx = elements.findIndex((e) => e.id === afterId);
        if (idx !== -1) {
          elements.splice(idx + 1, 0, newEl);
        } else {
          elements.push(newEl);
        }
      }
      const updated = { ...prev, elements, updatedAt: Date.now() };
      docRef.current = updated;
      recordSnapshot(updated, newId);
      return updated;
    });

    setActiveElementId(newId);
    activeElementIdRef.current = newId;
    return newId;
  }, [flushTypingCheckpoint, recordSnapshot]);

  const toggleSectionCollapse = useCallback((id: string) => {
    flushTypingCheckpoint();
    setDoc((prev) => {
      const elements = prev.elements.map((el) => {
        if (el.id === id && el.type === 'section') {
          return { ...el, collapsed: !(el as SectionElement).collapsed } as SectionElement;
        }
        return el;
      });
      const updated = { ...prev, elements, updatedAt: Date.now() };
      docRef.current = updated;
      recordSnapshot(updated, id);
      return updated;
    });
    setIsDirty(true);
  }, [flushTypingCheckpoint, recordSnapshot]);

  const scrollToElement = useCallback((id: string) => {
    // Uncollapse any parent sections if this element was hidden
    setDoc((prev) => {
      let needsUpdate = false;
      const elements = [...prev.elements];
      const targetIdx = elements.findIndex((e) => e.id === id);
      if (targetIdx !== -1) {
        for (let i = targetIdx - 1; i >= 0; i--) {
          const el = elements[i];
          if (el.type === 'section' && (el as SectionElement).collapsed) {
            elements[i] = { ...el, collapsed: false } as SectionElement;
            needsUpdate = true;
          }
        }
      }
      return needsUpdate ? { ...prev, elements, updatedAt: Date.now() } : prev;
    });

    setActiveElementId(id);

    setTimeout(() => {
      const el = document.querySelector(`[data-element-id="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-[#242e84]/40', 'rounded');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-[#242e84]/40', 'rounded');
        }, 1200);
      }
    }, 60);
  }, []);

  const deleteElement = useCallback((id: string) => {
    flushTypingCheckpoint();
    setDoc((prev) => {
      if (prev.elements.length <= 1) return prev;
      const idx = prev.elements.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      const elements = prev.elements.filter((e) => e.id !== id);
      const nextActive = elements[Math.max(0, idx - 1)]?.id || null;
      // Schedule activeElementId update outside the updater to avoid the React anti-pattern
      // of calling setState inside another setState's functional updater.
      setTimeout(() => {
        setActiveElementId(nextActive);
        activeElementIdRef.current = nextActive;
      }, 0);
      const updated = { ...prev, elements, updatedAt: Date.now() };
      docRef.current = updated;
      recordSnapshot(updated, nextActive);
      return updated;
    });
  }, [flushTypingCheckpoint, recordSnapshot]);

  const setElements = useCallback((elements: DocumentElement[], newActiveId?: string) => {
    flushTypingCheckpoint();
    const activeId = newActiveId || activeElementIdRef.current;
    setDoc((prev) => {
      const updated = { ...prev, elements, updatedAt: Date.now() };
      docRef.current = updated;
      recordSnapshot(updated, activeId);
      return updated;
    });
    if (newActiveId) {
      setActiveElementId(newActiveId);
      activeElementIdRef.current = newActiveId;
    }
  }, [flushTypingCheckpoint, recordSnapshot]);

  const evaluateMath = useCallback(async (id: string) => {
    const el = doc.elements.find((e) => e.id === id);
    if (!el || el.type !== 'math') return;

    updateElement(id, { isEvaluating: true });

    // Strip LaTeX color commands injected by MathLive's applyStyle()
    // e.g. \textcolor{red}{x^2} -> x^2, \color{blue} -> (empty)
    const stripColorCommands = (latex: string): string => {
      let result = latex;
      // Remove \textcolor{color}{content} -> content (handle nested braces)
      let prev = '';
      while (prev !== result) {
        prev = result;
        result = result.replace(/\\textcolor\{[^}]*\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '$1');
      }
      // Remove \color{color} or \color{color} standalone
      result = result.replace(/\\color\{[^}]*\}/g, '');
      return result;
    };

    try {
      const result = await evaluate(stripColorCommands(el.input));
      updateElement(id, {
        evaluated: true,
        isEvaluating: false,
        resultLatex: result.resultLatex,
        resultText: result.resultText,
        resultPlotSvg: result.plotSvg,
        resultType: result.resultType,
        error: result.error,
        errorCol: result.errorCol,
        errorSource: result.errorSource,
      });
    } catch (err: any) {
      updateElement(id, {
        evaluated: true,
        isEvaluating: false,
        resultPlotSvg: undefined,
        resultType: 'error',
        error: err?.message || 'Evaluation error',
      });
    }
  }, [doc.elements, evaluate, updateElement]);

  const evaluateAll = useCallback(async () => {
    for (const el of doc.elements) {
      if (el.type === 'math') {
        await evaluateMath(el.id);
      }
    }
  }, [doc.elements, evaluateMath]);

  const unevaluateMath = useCallback((id: string) => {
    updateElement(id, {
      evaluated: false,
      isEvaluating: false,
      resultLatex: undefined,
      resultText: undefined,
      resultPlotSvg: undefined,
      resultType: undefined,
      error: undefined,
      errorCol: undefined,
      errorSource: undefined,
    });
  }, [updateElement]);

  const unevaluateAll = useCallback(() => {
    for (const el of doc.elements) {
      if (el.type === 'math') {
        unevaluateMath(el.id);
      }
    }
  }, [doc.elements, unevaluateMath]);


  const insertAtCursor = useCallback((snippet: string) => {
    // 1. Check if a 2D math-field is active or focused
    let activeMathField = document.querySelector('math-field:focus') || 
      (document.activeElement && document.activeElement.tagName.toLowerCase() === 'math-field' ? document.activeElement : null);

    // 2. If no math-field has DOM focus, try to find the math-field in activeElementId
    if (!activeMathField && activeElementId) {
      const activeRow = document.querySelector(`[data-element-id="${activeElementId}"]`);
      if (activeRow) {
        activeMathField = activeRow.querySelector('math-field');
      }
    }

    if (activeMathField && 'executeCommand' in activeMathField) {
      (activeMathField as any).executeCommand(['insert', snippet]);
      try {
        (activeMathField as any).focus({ preventScroll: true });
      } catch {
        (activeMathField as any).focus();
      }
      return;
    }

    const input = activeInputRef.current;
    if (input) {
      if ('executeCommand' in input) {
        (input as any).executeCommand(['insert', snippet]);
        try {
          (input as any).focus({ preventScroll: true });
        } catch {
          (input as any).focus();
        }
        return;
      }

      if (input instanceof HTMLElement && input.isContentEditable) {
        document.execCommand('insertText', false, snippet);
        return;
      }

      const start = (input as HTMLTextAreaElement).selectionStart || 0;
      const end = (input as HTMLTextAreaElement).selectionEnd || 0;
      const val = (input as HTMLTextAreaElement).value || '';

      const nextVal = val.substring(0, start) + snippet + val.substring(end);
      (input as HTMLTextAreaElement).value = nextVal;
      const newPos = start + snippet.length;
      (input as HTMLTextAreaElement).setSelectionRange(newPos, newPos);
      try {
        (input as HTMLElement).focus({ preventScroll: true });
      } catch {
        (input as HTMLElement).focus();
      }

      const event = new Event('input', { bubbles: true });
      input.dispatchEvent(event);
      return;
    }

    // 3. Fallback: If no input or math-field is active, insert a new math line with this snippet
    const newId = insertElement('math', activeElementId || undefined);
    setTimeout(() => {
      const newMf = document.querySelector(`[data-element-id="${newId}"] math-field`) as any;
      if (newMf) {
        if ('executeCommand' in newMf) {
          newMf.executeCommand(['insert', snippet]);
        }
        try {
          newMf.focus({ preventScroll: true });
        } catch {
          newMf.focus();
        }
      }
    }, 60);
  }, [activeElementId, insertElement]);

  const insertMatrix = useCallback(
    (
      rows: number,
      cols: number,
      bracketType: 'pmatrix' | 'bmatrix' | 'vmatrix' | 'matrix' = 'pmatrix'
    ) => {
      const r = Math.max(1, Math.min(10, rows));
      const c = Math.max(1, Math.min(10, cols));
      const matrixRows: string[] = [];
      for (let i = 0; i < r; i++) {
        const rowCells: string[] = [];
        for (let j = 0; j < c; j++) {
          rowCells.push('#?');
        }
        matrixRows.push(rowCells.join(' & '));
      }
      const snippet = `\\begin{${bracketType}} ${matrixRows.join(' \\\\ ')} \\end{${bracketType}}`;
      insertAtCursor(snippet);
    },
    [insertAtCursor]
  );

  const insertRawTeX = useCallback(
    (latex: string) => {
      if (!latex.trim()) return;
      insertAtCursor(latex);
    },
    [insertAtCursor]
  );

  const saveDocument = useCallback(async (saveAs = false): Promise<boolean> => {
    const serialized = JSON.stringify(doc, null, 2);
    const api = window.regneAPI || window.hypatiaAPI;
    if (api) {
      const targetFilePath = !saveAs && filePath ? filePath : null;
      const defaultFilename = `${(doc.title || 'Untitled_Document').replace(/\s+/g, '_')}.regne`;
      const res = await api.saveDocument(serialized, targetFilePath, defaultFilename);
      if (res.success && res.filePath) {
        setFilePath(res.filePath);
        setIsDirty(false);
        api.updateWindowState({
          filePath: res.filePath,
          isDirty: false,
          title: doc.title || 'Untitled Document',
        });
        return true;
      }
      return false;
    } else {
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(doc.title || 'Untitled_Document').replace(/\s+/g, '_')}.regne`;
      a.click();
      URL.revokeObjectURL(url);
      setIsDirty(false);
      return true;
    }
  }, [doc, filePath]);

  const checkUnsavedChanges = useCallback(async (): Promise<boolean> => {
    if (!isDirty) return true;

    const api = window.regneAPI || window.hypatiaAPI;
    if (api) {
      const decision = await api.confirmDiscard(doc.title || 'Untitled Document');
      if (decision === 'save') {
        const saved = await saveDocument(false);
        return saved;
      }
      if (decision === 'discard') {
        return true;
      }
      return false;
    } else {
      return window.confirm('You have unsaved changes. Discard them?');
    }
  }, [isDirty, doc.title, saveDocument]);

  const newDocument = useCallback(async () => {
    const canProceed = await checkUnsavedChanges();
    if (!canProceed) return;

    localStorage.removeItem('regne:last-file-path');
    localStorage.removeItem('hypatia:last-file-path');
    const fresh = createInitialDocument();
    fresh.title = 'Untitled Document';
    setDoc(fresh);
    docRef.current = fresh;
    setFilePath(null);
    setIsDirty(false);
    const activeId = fresh.elements[0]?.id || null;
    setActiveElementId(activeId);
    activeElementIdRef.current = activeId;
    historyRef.current = [{
      doc: JSON.parse(JSON.stringify(fresh)),
      activeElementId: activeId,
    }];
    historyIdxRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);

    const api = window.regneAPI || window.hypatiaAPI;
    api?.updateWindowState({
      filePath: null,
      isDirty: false,
      title: 'Untitled Document',
    });
  }, [checkUnsavedChanges]);

  const openDocument = useCallback(async (): Promise<boolean> => {
    const canProceed = await checkUnsavedChanges();
    if (!canProceed) return false;

    const api = window.regneAPI || window.hypatiaAPI;
    if (api) {
      const res = await api.openDocument();
      if (res.success && res.content) {
        try {
          const parsed = JSON.parse(res.content) as RegneDocument;
          if (parsed && Array.isArray(parsed.elements)) {
            setDoc(parsed);
            docRef.current = parsed;
            setFilePath(res.filePath || null);
            setIsDirty(false);
            const activeId = parsed.elements[0]?.id || null;
            if (activeId) {
              setActiveElementId(activeId);
              activeElementIdRef.current = activeId;
            }
            historyRef.current = [{
              doc: JSON.parse(JSON.stringify(parsed)),
              activeElementId: activeId,
            }];
            historyIdxRef.current = 0;
            setCanUndo(false);
            setCanRedo(false);
            api.updateWindowState({
              filePath: res.filePath || null,
              isDirty: false,
              title: parsed.title || 'Untitled Document',
            });
            return true;
          }
        } catch {
          alert('Failed to parse Regne document format.');
        }
      }
      return false;
    }
    return false;
  }, [checkUnsavedChanges]);

  const loadDocumentFromData = useCallback((data: { filePath: string; content: string }) => {
    try {
      const parsed = JSON.parse(data.content) as RegneDocument;
      if (parsed && Array.isArray(parsed.elements)) {
        setDoc(parsed);
        docRef.current = parsed;
        setFilePath(data.filePath);
        setIsDirty(false);
        const activeId = parsed.elements[0]?.id || null;
        if (activeId) {
          setActiveElementId(activeId);
          activeElementIdRef.current = activeId;
        }
        historyRef.current = [{
          doc: JSON.parse(JSON.stringify(parsed)),
          activeElementId: activeId,
        }];
        historyIdxRef.current = 0;
        setCanUndo(false);
        setCanRedo(false);
        const api = window.regneAPI || window.hypatiaAPI;
        api?.updateWindowState({
          filePath: data.filePath,
          isDirty: false,
          title: parsed.title || 'Untitled Document',
        });
      }
    } catch (err) {
      console.error('Failed to parse opened file:', err);
    }
  }, []);

  const exportDocument = useCallback(async (type: 'tex' | 'html'): Promise<boolean> => {
    let content = '';
    if (type === 'tex') {
      content = `\\documentclass{article}\n\\usepackage{amsmath}\n\\usepackage{amsfonts}\n\\usepackage{amsthm}\n\\usepackage{xcolor}\n\n`;
      content += `\\newtheorem{theorem}{Theorem}\n\\newtheorem{lemma}{Lemma}\n\\newtheorem{definition}{Definition}\n\n`;
      content += `\\title{${doc.title}}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\\tableofcontents\n\\vspace{1cm}\n\n`;
      for (const el of doc.elements) {
        if (el.type === 'section') {
          const sec = el as SectionElement;
          const level = sec.level || 1;
          const title = sec.title || 'Untitled';
          if (sec.kind === 'theorem') {
            content += `\\begin{theorem}[${title}]\n\\end{theorem}\n\n`;
          } else if (sec.kind === 'lemma') {
            content += `\\begin{lemma}[${title}]\n\\end{lemma}\n\n`;
          } else if (level === 1) {
            content += `\\section{${title}}\n\n`;
          } else if (level === 2) {
            content += `\\subsection{${title}}\n\n`;
          } else {
            content += `\\subsubsection{${title}}\n\n`;
          }
        } else if (el.type === 'text') {
          content += `${el.content}\n\n`;
        } else if (el.type === 'math') {
          content += `\\begin{verbatim}\n${el.input}\n\\end{verbatim}\n`;
          if (el.resultLatex) {
            content += `\\begin{equation*}\n{\\color{blue} ${el.resultLatex}}\n\\end{equation*}\n\n`;
          }
        }
      }
      content += `\\end{document}\n`;
    } else {
      content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.title}</title>\n`;
      content += `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css">\n`;
      content += `<style>body{font-family:serif;max-width:760px;margin:3rem auto;padding:1rem;line-height:1.7} .math-in{font-family:monospace;color:#7f1d1d} .math-out{color:#0000bb;text-align:center;margin:1rem 0;font-size:1.2rem} h2{border-bottom:1px solid #e5e7eb;padding-bottom:0.3rem;margin-top:2rem} h3{margin-top:1.5rem} .theorem{background:#f8fafc;border-left:4px solid #242e84;padding:0.75rem 1rem;margin:1rem 0}</style></head><body>\n`;
      content += `<h1>${doc.title}</h1>\n`;
      const sections = doc.elements.filter(e => e.type === 'section') as SectionElement[];
      if (sections.length > 0) {
        content += `<nav style="background:#f9fafb;border:1px solid #e5e7eb;padding:1rem;margin-bottom:2rem;border-radius:4px;"><strong>Table of Contents</strong><ul style="padding-left:1.5rem;margin-top:0.5rem;">\n`;
        sections.forEach(s => {
          content += `<li><a href="#${s.id}">${s.title || 'Untitled'}</a></li>\n`;
        });
        content += `</ul></nav>\n`;
      }
      for (const el of doc.elements) {
        if (el.type === 'section') {
          const sec = el as SectionElement;
          const level = sec.level || 1;
          const title = sec.title || 'Untitled';
          if (sec.kind === 'theorem' || sec.kind === 'lemma') {
            content += `<div class="theorem" id="${sec.id}"><strong>${sec.kind === 'theorem' ? 'Theorem' : 'Lemma'}:</strong> ${title}</div>\n`;
          } else if (level === 1) {
            content += `<h2 id="${sec.id}">${title}</h2>\n`;
          } else if (level === 2) {
            content += `<h3 id="${sec.id}">${title}</h3>\n`;
          } else {
            content += `<h4 id="${sec.id}">${title}</h4>\n`;
          }
        } else if (el.type === 'text') {
          content += `<p>${el.content}</p>\n`;
        } else if (el.type === 'math') {
          content += `<div class="math-in">${el.input}</div>\n`;
          if (el.resultLatex) {
            content += `<div class="math-out">\\[${el.resultLatex}\\]</div>\n`;
          }
        }
      }
      content += `</body></html>`;
    }

    const api = window.regneAPI || window.hypatiaAPI;
    if (api) {
      const filterName = type === 'tex' ? 'LaTeX Document (*.tex)' : 'HTML Document (*.html)';
      const res = await api.exportDocument(content, type, filterName);
      return res.success;
    }
    return false;
  }, [doc]);

  // Synchronize OS window title and dirty indicator
  useEffect(() => {
    const api = window.regneAPI || window.hypatiaAPI;
    api?.updateWindowState({
      filePath,
      isDirty,
      title: doc.title || 'Untitled Document',
    });
  }, [filePath, isDirty, doc.title]);

  // Connect native application menu commands and file open requests
  useEffect(() => {
    const api = window.regneAPI || window.hypatiaAPI;
    if (!api) return;

    const unsubCommand = api.onMenuCommand((cmd) => {
      switch (cmd) {
        case 'save-file':
          saveDocument(false);
          break;
        case 'save-file-as':
          saveDocument(true);
          break;
        case 'open-file':
          openDocument();
          break;
        case 'new-file':
          newDocument();
          break;
        case 'export-latex':
          exportDocument('tex');
          break;
        case 'export-html':
          exportDocument('html');
          break;
        case 'undo':
          undo();
          break;
        case 'redo':
          redo();
          break;
        case 'evaluate-math':
          if (activeElementId) evaluateMath(activeElementId);
          break;
        case 'evaluate-all':
          evaluateAll();
          break;
        case 'insert-math': {
          const newId = insertElement('math', activeElementId || undefined);
          requestElementFocus(newId, { atEnd: false });
          break;
        }
        case 'insert-text': {
          const newId = insertElement('text', activeElementId || undefined);
          requestElementFocus(newId, { atEnd: false });
          break;
        }
        case 'restart-engine':
          resetEngine();
          break;
        case 'zoom-in':
          setZoom((prev) => Math.min(2.0, Number((prev + 0.1).toFixed(1))));
          break;
        case 'zoom-out':
          setZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(1))));
          break;
        case 'zoom-reset':
          setZoom(1.0);
          break;
      }
    });

    const unsubFile = api.onFileOpenRequest((data) => {
      loadDocumentFromData(data);
    });

    return () => {
      unsubCommand();
      unsubFile();
    };
  }, [
    saveDocument,
    openDocument,
    newDocument,
    exportDocument,
    undo,
    redo,
    activeElementId,
    evaluateMath,
    evaluateAll,
    loadDocumentFromData,
    insertElement,
    requestElementFocus,
    resetEngine,
  ]);

  // Global keyboard shortcuts (F5, Cmd/Ctrl+S, Cmd/Ctrl+Shift+S, Cmd/Ctrl+O, Cmd/Ctrl+N, Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        toggleMode();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
        if (key === 'y' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          redo();
          return;
        }
        if (key === 's') {
          e.preventDefault();
          e.stopPropagation();
          saveDocument(e.shiftKey);
        } else if (key === 'o' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          openDocument();
        } else if (key === 'n' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          newDocument();
        }
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [toggleMode, saveDocument, openDocument, newDocument, undo, redo]);

  return (
    <DocumentContext.Provider
      value={{
        document: doc,
        activeElementId,
        mode,
        zoom,
        filePath,
        isDirty,
        canUndo,
        canRedo,
        activeInputRef,
        isRulerVisible,
        rulerPosition,
        pageMargins,
        paperWidth,
        setRulerVisible: handleSetRulerVisible,
        toggleRuler,
        setRulerPosition: handleSetRulerPosition,
        setPageMargins: handleSetPageMargins,
        setMode,
        toggleMode,
        setTitle,
        setActiveElementId,
        updateElement,
        convertElementType,
        insertElement,
        insertSection,
        toggleSectionCollapse,
        scrollToElement,
        deleteElement,
        setElements,
        evaluateMath,
        evaluateAll,
        unevaluateMath,
        unevaluateAll,
        insertAtCursor,
        insertMatrix,
        insertRawTeX,
        newDocument,
        saveDocument,
        openDocument,
        exportDocument,
        setZoom,
        undo,
        redo,
        focusRequest,
        requestElementFocus,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};

export const useDocument = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocument must be used within a DocumentProvider');
  }
  return context;
};
