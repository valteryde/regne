import { Node, Span } from "./ast";
import { Block, InlineMath, readDocument } from "./document";
import { FreshValue, StatementDisplay } from "./displays";
import { hitNode } from "./hit";
import { Ir } from "./ir";
import { lower, lowerStatement } from "./lower";
import { toLatex } from "./toLatex";

/**
 * Calls whose picture is the operator. Their value stays off the sentence.
 * A constant such as `$2 + 2$` may still sit beside its expression.
 */
const OPERATOR_FORM = new Set(["diff", "integrate", "solve", "plot", "limit", "series"]);

export interface PageMath {
  latex: string;
  /** Span of the expression, inside the dollars. */
  span: Span;
  /** A constant value, or null when the expression is only typeset. */
  valueLatex: string | null;
}

export type PagePart = { kind: "text"; text: string } | ({ kind: "math" } & PageMath);

export type PageBlock =
  | { kind: "gap"; start: number; end: number }
  | { kind: "heading"; level: 1 | 2 | 3; title: string; start: number; end: number; caret: number }
  | { kind: "paragraph"; start: number; end: number; caret: number; parts: PagePart[] }
  | { kind: "display"; start: number; end: number; caret: number; display: StatementDisplay | null };

export interface PlanItem {
  role: "statement" | "inline";
  source: string;
  ir: Ir;
  /** Statement start, or the inline dollar span start. */
  key: number;
}

/**
 * The painted page. Markers stay in the file and do not appear here.
 * `inlineValues` is keyed by the dollar span's start.
 */
export function pageDocument(
  source: string,
  displays: StatementDisplay[],
  selection: Span | null,
  inlineValues?: ReadonlyMap<number, FreshValue>,
): PageBlock[] {
  const document = readDocument(source);
  if (document.legacy) return [];
  const byStart = new Map(displays.map((display) => [display.start, display]));
  const blocks: PageBlock[] = [];
  for (const block of document.blocks) {
    if (block.kind === "comment") continue;
    if (block.kind === "blank") {
      blocks.push({ kind: "gap", start: block.span.start, end: block.span.end });
      continue;
    }
    if (block.kind === "heading") {
      blocks.push({
        kind: "heading",
        level: block.level,
        title: block.title,
        start: block.span.start,
        end: block.span.end,
        caret: caretIn(source, block),
      });
      continue;
    }
    if (block.kind === "paragraph") {
      blocks.push({
        kind: "paragraph",
        start: block.span.start,
        end: block.span.end,
        caret: caretIn(source, block),
        parts: paragraphParts(source, block, selection, inlineValues),
      });
      continue;
    }
    blocks.push({
      kind: "display",
      start: block.span.start,
      end: block.span.end,
      caret: block.span.start,
      display: byStart.get(block.span.start) ?? null,
    });
  }
  return blocks;
}

/** Statements and the inline expressions that should be evaluated, in file order. */
export function evaluationPlan(blocks: Block[]): PlanItem[] {
  const items: PlanItem[] = [];
  for (const block of blocks) {
    if (block.kind === "statement" && block.parsed && !block.error) {
      items.push({
        role: "statement",
        source: block.source,
        ir: lowerStatement(block.parsed.node, block.parsed.displayOnly),
        key: block.span.start,
      });
      continue;
    }
    if (block.kind !== "paragraph") continue;
    for (const math of block.math) {
      if (!math.parsed || math.error || math.parsed.displayOnly || !takesInlineValue(math.parsed.node)) continue;
      items.push({
        role: "inline",
        source: math.source,
        ir: lower(math.parsed.node),
        key: math.span.start,
      });
    }
  }
  return items;
}

/** The block that owns a file offset. A caret on the block's end still belongs to it. */
export function anchorAt(blocks: PageBlock[], offset: number): PageBlock | null {
  let nearest: PageBlock | null = null;
  for (const block of blocks) {
    if (block.start <= offset && offset <= block.end) return block;
    if (block.start <= offset) nearest = block;
  }
  return nearest ?? blocks[0] ?? null;
}

/** The visible characters of a painted page, markers already removed. */
export function pageText(blocks: PageBlock[]): string {
  return blocks
    .map((block) => {
      if (block.kind === "heading") return block.title;
      if (block.kind === "paragraph") {
        return block.parts.map((part) => (part.kind === "text" ? part.text : part.latex)).join("");
      }
      return "";
    })
    .join("\n");
}

function paragraphParts(
  source: string,
  block: Extract<Block, { kind: "paragraph" }>,
  selection: Span | null,
  inlineValues: ReadonlyMap<number, FreshValue> | undefined,
): PagePart[] {
  const origin = textOrigin(source, block);
  const parts: PagePart[] = [];
  let cursor = origin;
  const end = origin + block.text.length;
  for (const math of block.math) {
    if (math.span.start > cursor) {
      parts.push({ kind: "text", text: source.slice(cursor, math.span.start) });
    }
    parts.push(paintMath(source, math, selection, inlineValues?.get(math.span.start)));
    cursor = math.span.end;
  }
  if (cursor < end) parts.push({ kind: "text", text: source.slice(cursor, end) });
  return parts;
}

function paintMath(
  source: string,
  math: InlineMath,
  selection: Span | null,
  fresh: FreshValue | undefined,
): PagePart {
  if (!math.parsed) {
    return { kind: "text", text: source.slice(math.span.start, math.span.end) };
  }
  const hit = selection ? hitNode(math.parsed, selection)?.span ?? null : null;
  const latex = toLatex(math.parsed.node, hit);
  return {
    kind: "math",
    latex,
    span: math.parsed.node.span,
    valueLatex: fresh && takesInlineValue(math.parsed.node) ? constantLatex(latex, fresh) : null,
  };
}

function takesInlineValue(node: Node): boolean {
  if (node.type === "assign" || node.type === "equation" || node.type === "range" || node.type === "compare") {
    return false;
  }
  if (node.type === "name" && node.text === "restart") return false;
  if (node.type === "call" && OPERATOR_FORM.has(node.callee.text)) return false;
  return true;
}

/**
 * A quantity, or an expression whose value is a number.
 * A symbolic result is the expression again, so it stays typeset only.
 */
export function constantLatex(inputLatex: string, value: FreshValue): string | null {
  if (value.kind === "error" || value.kind === "plot" || !value.latex) return null;
  if (value.kind === "quantity") return value.latex;
  if (value.kind !== "expression") return null;
  if (/[A-Za-z]/.test(value.latex)) return null;
  if (visibleMath(inputLatex) === visibleMath(value.latex)) return null;
  return value.latex;
}

function visibleMath(latex: string): string {
  return latex
    .replace(/\\htmlClass\{[^{}]*\}/g, "")
    .replace(/\\htmlData\{[^{}]*\}/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, "");
}

function textOrigin(source: string, block: Extract<Block, { kind: "paragraph" }>): number {
  let origin = block.marker.end;
  if (source[origin] === " ") origin += 1;
  return origin;
}

function caretIn(source: string, block: Extract<Block, { kind: "heading" | "paragraph" }>): number {
  if (block.kind === "paragraph") return textOrigin(source, block);
  let origin = block.marker.end;
  if (source[origin] === " ") origin += 1;
  return origin;
}

export interface HeldRow {
  id: string;
  key: string;
}

/**
 * Stable across an edit above this row. Offsets and the selection highlight
 * are not part of it, so typing higher on the page does not remount the row.
 */
export function rowIdentity(source: string, block: PageBlock): string {
  if (block.kind === "gap") return "gap";
  if (block.kind === "heading") return `h:${block.level}:${block.title}`;
  if (block.kind === "paragraph") return `p:${source.slice(block.start, block.end)}`;
  return `s:${source.slice(block.start, block.end)}`;
}

/** Give an unchanged row the key it had last time. A new row gets a fresh one. */
export function alignRowKeys(previous: readonly HeldRow[], ids: readonly string[]): string[] {
  const queues = new Map<string, string[]>();
  for (const item of previous) {
    const list = queues.get(item.id) ?? [];
    list.push(item.key);
    queues.set(item.id, list);
  }
  const used = new Set(previous.map((item) => item.key));
  let fresh = previous.length;
  return ids.map((id) => {
    const reused = queues.get(id)?.shift();
    if (reused) return reused;
    let key = "";
    do {
      fresh += 1;
      key = `row-${fresh}`;
    } while (used.has(key));
    used.add(key);
    return key;
  });
}
