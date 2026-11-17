import { Block } from "./document";
import { toLatex } from "./toLatex";

export interface StatementDisplay {
  /** Start offset of the statement. This is how a broken edit finds its previous drawing. */
  start: number;
  source: string;
  inputLatex: string;
  valueLatex: string;
  valueKind: string;
  valueSvg: string;
  error: string | null;
  /** The source no longer parses, so the drawing is the previous good one. */
  stale: boolean;
}

export interface FreshValue {
  latex: string;
  kind: string;
  message?: string;
  svg?: string;
}

/**
 * Pair each statement with a value.
 * A statement that fails to parse keeps the display from the same start offset.
 * Parsed statements consume `values` in order. A bad line is not one of them.
 */
export function reconcileDisplays(
  blocks: Block[],
  previous: StatementDisplay[],
  values: FreshValue[],
): StatementDisplay[] {
  const kept = new Map(previous.map((display) => [display.start, display]));
  const displays: StatementDisplay[] = [];
  let valueIndex = 0;
  for (const block of blocks) {
    if (block.kind !== "statement") continue;
    if (block.error || !block.parsed) {
      const prior = kept.get(block.span.start);
      displays.push({
        start: block.span.start,
        source: block.source,
        inputLatex: prior?.inputLatex ?? "",
        valueLatex: prior?.valueLatex ?? "",
        valueKind: prior?.valueKind ?? "error",
        valueSvg: prior?.valueSvg ?? "",
        error: block.error?.message ?? "Enter a statement.",
        stale: prior != null && prior.inputLatex !== "",
      });
      continue;
    }
    const value = values[valueIndex++] ?? { latex: "", kind: "error" };
    displays.push({
      start: block.span.start,
      source: block.source,
      inputLatex: toLatex(block.parsed.node, null),
      valueLatex: value.latex,
      valueKind: value.kind,
      valueSvg: value.svg ?? "",
      error: value.kind === "error" ? value.message || value.latex || "Error" : null,
      stale: false,
    });
  }
  return displays;
}
