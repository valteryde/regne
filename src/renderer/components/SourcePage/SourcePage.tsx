import React, { useEffect, useRef, useState } from "react";
import { KeyCode, KeyMod, Range, editor } from "monaco-editor/editor/editor.api";
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import "monaco-editor-css";
import { CYLINDER_NOTE, isLegacyDocument, readDocument } from "../../../language/document";
import { importLegacy } from "../../../language/import";
import { FreshValue, StatementDisplay } from "../../../language/displays";
import {
  RECOMPUTE_PAUSE_MS,
  brokenLineNumbers,
  cachedValues,
  createPause,
  paint,
  storeValues,
} from "../../../language/session";
import { Span } from "../../../language/ast";
import { exportHtml, exportLatex } from "../../../language/export";
import { evaluationPlan } from "../../../language/page";
import {
  PointerTarget,
  paintSelection,
  selectionFromPointer,
  stepSelection,
  unionSpan,
} from "../../../language/selection";
import { useDocument } from "../../context/DocumentContext";
import { publishSourceLabel, registerSourceCommands } from "../../sourceCommands";
import { evaluateIr } from "./evaluateIr";
import { registerRegneLanguage } from "./language";
import { readPointer } from "./pointer";
import { blockAtTop, blockForOffset, scrollBlockIntoPage } from "./scroll";
import { Sheet } from "./Sheet";

const SOURCE_KEY = "regne:source-buffer";
const PATH_KEY = "regne:source-path";

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

function storedSource(): string {
  try {
    const saved = localStorage.getItem(SOURCE_KEY);
    if (saved != null) return saved;
  } catch {
    // A private window has no storage. The note is still the default file.
  }
  return CYLINDER_NOTE;
}

function openBuffer(saved: string): { text: string; notice: string | null } {
  if (!isLegacyDocument(saved)) return { text: saved, notice: null };
  const imported = importLegacy(saved);
  return { text: imported.text, notice: imported.notes.join(" ") || null };
}

function storedPath(): string | null {
  try {
    const saved = localStorage.getItem(PATH_KEY);
    return saved ? saved : null;
  } catch {
    return null;
  }
}

function suggestedName(text: string): string {
  const heading = readDocument(text).blocks.find((block) => block.kind === "heading");
  const title = heading && heading.kind === "heading" ? heading.title.trim() : "";
  const slug = title.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
  return `${slug || "Untitled"}.regne`;
}

function sameSpan(left: Span | null, right: Span | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.start === right.start && left.end === right.end;
}

function selectionOf(codeEditor: editor.IStandaloneCodeEditor): Span | null {
  const model = codeEditor.getModel();
  const selected = codeEditor.getSelection();
  if (!model || !selected) return null;
  const start = model.getOffsetAt({ lineNumber: selected.startLineNumber, column: selected.startColumn });
  const end = model.getOffsetAt({ lineNumber: selected.endLineNumber, column: selected.endColumn });
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function selectSpan(codeEditor: editor.IStandaloneCodeEditor, span: Span): void {
  const model = codeEditor.getModel();
  if (!model) return;
  const length = model.getValueLength();
  const start = model.getPositionAt(Math.min(span.start, length));
  const end = model.getPositionAt(Math.min(span.end, length));
  const range = new Range(start.lineNumber, start.column, end.lineNumber, end.column);
  codeEditor.setSelection(range);
  codeEditor.revealRangeInCenterIfOutsideViewport(range);
}

function documentTitle(text: string, filePath: string | null): string {
  if (filePath) return filePath.split(/[/\\]/).pop() || "Untitled.regne";
  const heading = readDocument(text).blocks.find((block) => block.kind === "heading");
  if (heading && heading.kind === "heading" && heading.title.trim()) return heading.title.trim();
  return "Untitled.regne";
}

export const SourcePage: React.FC = () => {
  const { paperWidth, zoom, pageMargins } = useDocument();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const applying = useRef(false);
  const generation = useRef(0);
  const cacheRef = useRef(new Map<string, FreshValue>());
  const displaysRef = useRef<StatementDisplay[]>([]);
  const opened = useRef(openBuffer(storedSource()));
  const sourceRef = useRef(opened.current.text);
  const pathRef = useRef<string | null>(storedPath());
  const savedRef = useRef(sourceRef.current);
  const alive = useRef(true);
  const selectionRef = useRef<Span | null>(null);
  const dragging = useRef(false);
  const touched = useRef<Span[]>([]);
  const syncLock = useRef(0);

  const [source, setSource] = useState(sourceRef.current);
  const [path, setPath] = useState<string | null>(pathRef.current);
  const [dirty, setDirty] = useState(false);
  const [displays, setDisplays] = useState<StatementDisplay[]>([]);
  const [selection, setSelection] = useState<Span | null>(null);
  const [inlineValues, setInlineValues] = useState<ReadonlyMap<number, FreshValue>>(new Map());
  const [legacy, setLegacy] = useState(false);
  const [notice, setNotice] = useState<string | null>(opened.current.notice);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  const pauseRef = useRef(
    createPause(
      RECOMPUTE_PAUSE_MS,
      (run, ms) => window.setTimeout(run, ms),
      (handle) => window.clearTimeout(handle as number),
    ),
  );

  const recompute = async (text: string) => {
    const token = ++generation.current;
    const document = readDocument(text);
    if (document.legacy) {
      if (!alive.current || token !== generation.current) return;
      setLegacy(true);
      setEngineError(null);
      setPending(false);
      displaysRef.current = [];
      setDisplays([]);
      setInlineValues(new Map());
      return;
    }
    const plan = evaluationPlan(document.blocks);
    const sources = plan.map((item) => item.source);
    let values = cachedValues(sources, cacheRef.current);
    if (!values) {
      try {
        values = await evaluateIr(plan.map((item) => item.ir));
        if (!alive.current || token !== generation.current) return;
        storeValues(sources, values, cacheRef.current);
        setEngineError(null);
      } catch (err) {
        if (!alive.current || token !== generation.current) return;
        const message = err instanceof Error ? err.message : "The engine failed.";
        setEngineError(message);
        values = sources.map(() => ({ latex: "", kind: "error", message }));
      }
    }
    if (!alive.current || token !== generation.current) return;
    const statementValues = (values ?? []).filter((_, index) => plan[index]?.role === "statement");
    const inlines = new Map<number, FreshValue>();
    plan.forEach((item, index) => {
      if (item.role === "inline" && values?.[index]) inlines.set(item.key, values[index]);
    });
    const next = paintSelection(text, paint(text, statementValues, displaysRef.current), selectionRef.current);
    displaysRef.current = next;
    setInlineValues(inlines);
    setLegacy(false);
    setPending(false);
    setDisplays(next);
  };

  const recomputeRef = useRef(recompute);
  recomputeRef.current = recompute;

  const publish = (text: string, filePath: string | null, isDirty: boolean) => {
    const api = window.regneAPI || window.hypatiaAPI;
    api?.updateWindowState({
      filePath,
      isDirty,
      title: documentTitle(text, filePath),
    });
  };

  const remember = (text: string, filePath: string | null) => {
    try {
      localStorage.setItem(SOURCE_KEY, text);
      localStorage.setItem(PATH_KEY, filePath ?? "");
    } catch {
      // Storage can be full or blocked. The buffer in the editor is still the file.
    }
  };

  const applyText = (text: string, filePath: string | null) => {
    const openedFile = openBuffer(text);
    text = openedFile.text;
    setNotice(openedFile.notice);
    sourceRef.current = text;
    applying.current = true;
    editorRef.current?.setValue(text);
    applying.current = false;
    pathRef.current = filePath;
    savedRef.current = text;
    setSource(text);
    setPath(filePath);
    setDirty(false);
    remember(text, filePath);
    publish(text, filePath, false);
    void recomputeRef.current(text);
  };

  const exportFile = async (kind: "tex" | "html") => {
    const text = editorRef.current?.getValue() ?? sourceRef.current;
    const content = kind === "tex" ? exportLatex(text) : exportHtml(text);
    const api = window.regneAPI || window.hypatiaAPI;
    const name = suggestedName(text).replace(/\.regne$/, kind === "tex" ? ".tex" : ".html");
    if (api?.exportDocument) {
      await api.exportDocument(content, kind, kind === "tex" ? "LaTeX" : "HTML");
      return;
    }
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const save = async (saveAs: boolean): Promise<boolean> => {
    const text = editorRef.current?.getValue() ?? sourceRef.current;
    const api = window.regneAPI || window.hypatiaAPI;
    if (!api?.saveDocument) {
      savedRef.current = text;
      setDirty(false);
      remember(text, pathRef.current);
      publish(text, pathRef.current, false);
      return true;
    }
    const result = await api.saveDocument(text, saveAs ? null : pathRef.current, suggestedName(text));
    if (!result.success || !result.filePath) return false;
    pathRef.current = result.filePath;
    savedRef.current = text;
    setPath(result.filePath);
    setDirty(false);
    remember(text, result.filePath);
    publish(text, result.filePath, false);
    return true;
  };

  const confirmLeave = async (): Promise<boolean> => {
    if (sourceRef.current === savedRef.current) return true;
    const api = window.regneAPI || window.hypatiaAPI;
    if (!api?.confirmDiscard) return true;
    const decision = await api.confirmDiscard(documentTitle(sourceRef.current, pathRef.current));
    if (decision === "cancel") return false;
    if (decision === "save") return save(pathRef.current == null);
    return true;
  };

  const open = async () => {
    if (!(await confirmLeave())) return;
    const api = window.regneAPI || window.hypatiaAPI;
    if (!api?.openDocument) return;
    const result = await api.openDocument();
    if (!result.success || result.canceled || result.content == null) return;
    applyText(result.content, result.filePath ?? null);
  };

  const newFile = async () => {
    if (!(await confirmLeave())) return;
    applyText(CYLINDER_NOTE, null);
  };

  const actions = useRef({ save, open, applyText, newFile, confirmLeave, exportFile });
  actions.current = { save, open, applyText, newFile, confirmLeave, exportFile };

  useEffect(() => {
    alive.current = true;
    const node = hostRef.current;
    if (!node) return;
    registerRegneLanguage();
    const codeEditor = editor.create(node, {
      value: sourceRef.current,
      language: "regne",
      theme: "regne",
      fontSize: 13,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      minimap: { enabled: false },
      wordWrap: "on",
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      padding: { top: 16, bottom: 16 },
      renderLineHighlight: "line",
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      glyphMargin: false,
      folding: false,
      scrollBeyondLastColumn: 0,
    });
    editorRef.current = codeEditor;
    const paintEditorSelection = () => {
      const span = selectionOf(codeEditor);
      selectionRef.current = span;
      setSelection((prev) => (sameSpan(prev, span) ? prev : span));
      const next = paintSelection(sourceRef.current, displaysRef.current, span);
      if (next === displaysRef.current) return;
      displaysRef.current = next;
      setDisplays(next);
    };
    const subscription = codeEditor.onDidChangeModelContent(() => {
      if (applying.current) return;
      const text = codeEditor.getValue();
      sourceRef.current = text;
      setSource(text);
      const isDirty = text !== savedRef.current;
      setDirty(isDirty);
      publish(text, pathRef.current, isDirty);
      pauseRef.current.push(() => {
        void recomputeRef.current(text);
      });
    });
    const selectionSubscription = codeEditor.onDidChangeCursorSelection(paintEditorSelection);
    const nudge = (direction: "parent" | "child") => {
      const current = selectionOf(codeEditor);
      if (!current) return;
      const next = stepSelection(sourceRef.current, current, direction);
      if (!next) return;
      selectSpan(codeEditor, next);
    };
    codeEditor.addCommand(KeyMod.Alt | KeyCode.UpArrow, () => nudge("parent"));
    codeEditor.addCommand(KeyMod.Alt | KeyCode.DownArrow, () => nudge("child"));
    codeEditor.focus();
    void recomputeRef.current(sourceRef.current);
    return () => {
      alive.current = false;
      generation.current += 1;
      pauseRef.current.cancel();
      subscription.dispose();
      selectionSubscription.dispose();
      codeEditor.dispose();
      editorRef.current = null;
    };
    // The editor is created once. Later text arrives through applyText.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const codeEditor = editorRef.current;
    const page = document.querySelector<HTMLElement>("[data-regne-page]");
    if (!codeEditor || !page) return;
    const span = selectionRef.current;
    if (!span) return;
    const block = blockForOffset(page, span.start);
    if (!block) return;
    syncLock.current += 1;
    scrollBlockIntoPage(page, block);
    const model = codeEditor.getModel();
    if (model) {
      const position = model.getPositionAt(Math.min(span.start, model.getValueLength()));
      codeEditor.revealPositionInCenterIfOutsideViewport(position);
    }
    let released = false;
    const release = window.requestAnimationFrame(() => {
      released = true;
      syncLock.current = Math.max(0, syncLock.current - 1);
    });
    return () => {
      window.cancelAnimationFrame(release);
      if (!released) syncLock.current = Math.max(0, syncLock.current - 1);
    };
  }, [source, selection]);

  useEffect(() => {
    const codeEditor = editorRef.current;
    const page = document.querySelector<HTMLElement>("[data-regne-page]");
    if (!codeEditor || !page) return;
    const hold = () => {
      syncLock.current += 1;
      window.requestAnimationFrame(() => {
        syncLock.current = Math.max(0, syncLock.current - 1);
      });
    };
    const revealCaret = () => {
      if (syncLock.current) return;
      const span = selectionOf(codeEditor);
      if (!span) return;
      const block = blockForOffset(page, span.start);
      if (!block) return;
      hold();
      scrollBlockIntoPage(page, block);
    };
    const revealEditor = () => {
      if (syncLock.current) return;
      if (page.scrollHeight <= page.clientHeight) return;
      const block = blockAtTop(page);
      const start = Number(block?.getAttribute("data-regne-start"));
      const model = codeEditor.getModel();
      if (!block || !model || !Number.isFinite(start)) return;
      hold();
      const position = model.getPositionAt(Math.min(start, model.getValueLength()));
      codeEditor.revealPositionInCenterIfOutsideViewport(position);
    };
    const cursor = codeEditor.onDidChangeCursorPosition(revealCaret);
    const scrolled = codeEditor.onDidScrollChange(revealCaret);
    page.addEventListener("scroll", revealEditor);
    return () => {
      cursor.dispose();
      scrolled.dispose();
      page.removeEventListener("scroll", revealEditor);
    };
  }, []);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!dragging.current) return;
      const codeEditor = editorRef.current;
      if (!codeEditor) return;
      const span = selectionFromPointer(sourceRef.current, readPointer(document.elementFromPoint(event.clientX, event.clientY)));
      if (!span) return;
      touched.current.push(span);
      const union = unionSpan(touched.current);
      if (union) selectSpan(codeEditor, union);
    };
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const beginPointer = (pointer: PointerTarget) => {
    const codeEditor = editorRef.current;
    if (!codeEditor) return;
    const span = selectionFromPointer(sourceRef.current, pointer);
    if (!span) return;
    dragging.current = true;
    touched.current = [span];
    selectSpan(codeEditor, span);
  };

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const lines = brokenLineNumbers(source, displays);
    const collection = editor.createDecorationsCollection(
      lines.map((line) => ({
        range: new Range(line, 1, line, 1),
        options: { isWholeLine: true, className: "regne-broken-line" },
      })),
    );
    return () => collection.clear();
  }, [source, displays]);

  useEffect(() => {
    const id = window.setTimeout(() => remember(source, path), 1000);
    return () => window.clearTimeout(id);
  }, [source, path]);

  useEffect(() => {
    publishSourceLabel({ title: documentTitle(source, path), dirty });
  }, [source, path, dirty]);

  useEffect(() => () => publishSourceLabel(null), []);

  useEffect(() => {
    publish(sourceRef.current, pathRef.current, sourceRef.current !== savedRef.current);
    return registerSourceCommands(
      (command) => {
        const editor = editorRef.current;
        if (command === "save") void actions.current.save(false);
        else if (command === "save-as") void actions.current.save(true);
        else if (command === "open") void actions.current.open();
        else if (command === "new") void actions.current.newFile();
        else if (command === "undo") editor?.trigger("menu", "undo", null);
        else if (command === "redo") editor?.trigger("menu", "redo", null);
        else if (command === "export") void actions.current.exportFile("tex");
        else if (command === "export-html") void actions.current.exportFile("html");
      },
      (content, filePath) => {
        void (async () => {
          if (!(await actions.current.confirmLeave())) return;
          actions.current.applyText(content, filePath);
        })();
      },
    );
  }, []);

  return (
    <div data-regne-source className="flex flex-1 min-h-0 h-full">
      <div className="w-1/2 min-w-0 min-h-0 border-r border-[var(--border-color)]">
        <div ref={hostRef} className="h-full" />
      </div>
      <div className="w-1/2 min-w-0 min-h-0">
        <Sheet
          source={source}
          displays={displays}
          legacy={legacy}
          notice={notice}
          engineError={engineError}
          pending={pending}
          paperWidth={paperWidth}
          zoom={zoom}
          marginLeft={pageMargins.left}
          marginRight={pageMargins.right}
          selection={selection}
          inlineValues={inlineValues}
          onMouseDown={() => editorRef.current?.focus()}
          onPointerDown={beginPointer}
        />
      </div>
      <span className="sr-only" data-dirty={dirty ? "true" : "false"} />
    </div>
  );
};
