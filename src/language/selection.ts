import { Node, Span, children } from "./ast";
import { Block, readDocument } from "./document";
import { StatementDisplay } from "./displays";
import { hitNode } from "./hit";
import { toLatex } from "./toLatex";

export interface PointerTarget {
  /** Innermost painted span under the pointer, or null when the pointer is not on input math. */
  span: Span | null;
  /** Start offset of the display under the pointer. */
  statementStart: number | null;
  /** The pointer is on the computed value, a plot, or the error, not the input tree. */
  inValue: boolean;
}

export interface SpanHost {
  getAttribute(name: string): string | null;
  parentElement: SpanHost | null;
}

type StatementBlock = Extract<Block, { kind: "statement" }>;

/** `data-span="start:end"` from a KaTeX htmlData wrapper. */
export function spanAttribute(value: string | null): Span | null {
  if (!value) return null;
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end < start) return null;
  return { start, end };
}

/** The innermost painted span. The walk starts at the element under the pointer. */
export function spanFromHost(host: SpanHost | null): Span | null {
  let node = host;
  while (node) {
    const span = spanAttribute(node.getAttribute("data-span"));
    if (span) return span;
    node = node.parentElement;
  }
  return null;
}

export function unionSpan(spans: Span[]): Span | null {
  if (spans.length === 0) return null;
  let start = spans[0].start;
  let end = spans[0].end;
  for (const span of spans) {
    if (span.start < start) start = span.start;
    if (span.end > end) end = span.end;
  }
  return { start, end };
}

/**
 * A click on input math selects that span.
 * A click on the value or the plot selects the whole statement.
 */
export function selectionFromPointer(source: string, pointer: PointerTarget): Span | null {
  if (pointer.inValue && pointer.statementStart != null) {
    return statementByStart(readDocument(source).blocks, pointer.statementStart)?.span ?? null;
  }
  return pointer.span;
}

/**
 * Alt+Up selects the parent of the current hit. Alt+Down selects its first child.
 * The current hit is whatever `hitNode` says the selection is.
 */
export function stepSelection(source: string, selection: Span, direction: "parent" | "child"): Span | null {
  const block = statementCovering(readDocument(source).blocks, selection);
  if (!block?.parsed) return null;
  const hit = hitNode(block.parsed, selection);
  if (!hit) return null;
  if (direction === "child") return children(hit)[0]?.span ?? null;
  return parentOf(block.parsed.node, hit)?.span ?? null;
}

/**
 * Reprint the statement that contains the selection, and clear a hit that moved away.
 * Displays that did not change keep their identity, so neighbors are not redrawn.
 */
export function paintSelection(
  source: string,
  displays: StatementDisplay[],
  selection: Span | null,
): StatementDisplay[] {
  const blocks = readDocument(source).blocks;
  const active = selection ? statementCovering(blocks, selection) : null;
  const activeLatex =
    active?.parsed && selection ? toLatex(active.parsed.node, hitNode(active.parsed, selection)?.span ?? null) : null;

  let changed = false;
  const next = displays.map((display) => {
    if (active && display.start === active.span.start && activeLatex != null) {
      if (display.inputLatex === activeLatex) return display;
      changed = true;
      return { ...display, inputLatex: activeLatex };
    }
    if (!display.inputLatex.includes("regne-hit")) return display;
    const block = statementByStart(blocks, display.start);
    if (!block?.parsed) return display;
    const plain = toLatex(block.parsed.node, null);
    if (plain === display.inputLatex) return display;
    changed = true;
    return { ...display, inputLatex: plain };
  });
  return changed ? next : displays;
}

function statementCovering(blocks: Block[], selection: Span): StatementBlock | null {
  for (const block of blocks) {
    if (block.kind !== "statement") continue;
    if (block.span.start <= selection.start && selection.end <= block.span.end) return block;
  }
  return null;
}

function statementByStart(blocks: Block[], start: number): StatementBlock | null {
  for (const block of blocks) {
    if (block.kind === "statement" && block.span.start === start) return block;
  }
  return null;
}

function parentOf(root: Node, target: Node): Node | null {
  for (const child of children(root)) {
    if (child.span.start === target.span.start && child.span.end === target.span.end) return root;
    const found = parentOf(child, target);
    if (found) return found;
  }
  return null;
}
