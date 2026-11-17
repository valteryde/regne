import { Block, readDocument } from "./document";
import { FreshValue, StatementDisplay, reconcileDisplays } from "./displays";
import { Ir } from "./ir";
import { lowerStatement } from "./lower";

/** Wait this long after the last key before asking the engine again. */
export const RECOMPUTE_PAUSE_MS = 300;

export interface RunnableStatement {
  source: string;
  ir: Ir;
}

export interface PageRow {
  kind: "gap" | "raw" | "display";
  start: number;
  /** Raw heading or paragraph, markers included. Empty for a gap or a display. */
  text: string;
  display: StatementDisplay | null;
}

export interface Pause {
  push(run: () => void): void;
  cancel(): void;
}

/**
 * The cache key is this statement plus every statement that ran before it.
 * Those earlier lines are the bindings this one used.
 */
export function cacheKey(sources: string[], index: number): string {
  return sources.slice(0, index + 1).join("\n");
}

export function cachedValues(sources: string[], cache: Map<string, FreshValue>): FreshValue[] | null {
  const values: FreshValue[] = [];
  for (let index = 0; index < sources.length; index++) {
    const hit = cache.get(cacheKey(sources, index));
    if (!hit) return null;
    values.push(hit);
  }
  return values;
}

export function storeValues(sources: string[], values: FreshValue[], cache: Map<string, FreshValue>): void {
  sources.forEach((_, index) => {
    const value = values[index];
    if (value) cache.set(cacheKey(sources, index), value);
  });
}

/** Statements the engine should see. A line that does not parse is left out. */
export function runnableStatements(blocks: Block[]): RunnableStatement[] {
  const statements: RunnableStatement[] = [];
  for (const block of blocks) {
    if (block.kind !== "statement" || block.error || !block.parsed) continue;
    statements.push({ source: block.source, ir: lowerStatement(block.parsed.node) });
  }
  return statements;
}

/**
 * One row per block the page shows.
 * A heading or a paragraph is its raw source, marker included.
 * A bare line is a display, never prose.
 */
export function pageRows(source: string, displays: StatementDisplay[]): PageRow[] {
  const document = readDocument(source);
  if (document.legacy) return [];
  const byStart = new Map(displays.map((display) => [display.start, display]));
  const rows: PageRow[] = [];
  for (const block of document.blocks) {
    if (block.kind === "comment") continue;
    if (block.kind === "blank") {
      rows.push({ kind: "gap", start: block.span.start, text: "", display: null });
      continue;
    }
    if (block.kind === "heading" || block.kind === "paragraph") {
      rows.push({
        kind: "raw",
        start: block.span.start,
        text: source.slice(block.span.start, block.span.end),
        display: null,
      });
      continue;
    }
    rows.push({
      kind: "display",
      start: block.span.start,
      text: "",
      display: byStart.get(block.span.start) ?? null,
    });
  }
  return rows;
}

export function paint(source: string, values: FreshValue[], previous: StatementDisplay[]): StatementDisplay[] {
  return reconcileDisplays(readDocument(source).blocks, previous, values);
}

/** Lines whose statement failed to parse. An evaluation error is not one of these. */
export function brokenLineNumbers(source: string, displays: StatementDisplay[]): number[] {
  return displays
    .filter((display) => display.stale || (display.error != null && display.inputLatex === ""))
    .map((display) => lineNumberAt(source, display.start));
}

/** 1-based line of a file offset, for marking a broken statement in the source. */
export function lineNumberAt(source: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, source.length);
  for (let index = 0; index < end; index++) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

export function createPause(
  wait: number,
  schedule: (run: () => void, ms: number) => unknown,
  clear: (handle: unknown) => void,
): Pause {
  let handle: unknown = null;
  return {
    push(run) {
      if (handle != null) clear(handle);
      handle = schedule(run, wait);
    },
    cancel() {
      if (handle != null) clear(handle);
      handle = null;
    },
  };
}
