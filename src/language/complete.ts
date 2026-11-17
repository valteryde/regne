import { UNIT_NAMES } from "./units";

/** Spec section 4.6. These names are always offered outside unit brackets. */
export const CORE_NAMES = [
  "diff",
  "integrate",
  "solve",
  "simplify",
  "factor",
  "expand",
  "limit",
  "series",
  "subs",
  "sqrt",
  "abs",
  "log",
  "ln",
  "exp",
  "sin",
  "cos",
  "tan",
  "pi",
  "E",
  "I",
  "oo",
  "plot",
  "restart",
] as const;

/** How a source line should be colored before the page catches up. */
export function lineTone(line: string): "heading" | "paragraph" | "comment" | "statement" {
  const body = line.trimStart();
  if (body.startsWith("//")) return "comment";
  if (/^#{1,3} /.test(body)) return "heading";
  if (body.startsWith("-- ")) return "paragraph";
  return "statement";
}

/** The caret is inside unit brackets, not a list. `before` is the text to the left of the caret. */
export function insideUnit(before: string): boolean {
  let depth = 0;
  let unit = false;
  for (let index = 0; index < before.length; index++) {
    const ch = before[index];
    if (ch === "[") {
      if (depth === 0) unit = opensUnit(before.slice(0, index));
      depth += 1;
    } else if (ch === "]" && depth > 0) {
      depth -= 1;
      if (depth === 0) unit = false;
    }
  }
  return depth > 0 && unit;
}

export function suggestions(before: string): string[] {
  const partial = /[A-Za-z_][A-Za-z0-9_]*$/.exec(before)?.[0] ?? "";
  const pool = insideUnit(before) ? UNIT_NAMES : CORE_NAMES;
  return pool.filter((name) => name.startsWith(partial));
}

/** Text for a unit picked in the header, and the caret offset inside that text. */
export function unitInsert(before: string, name: string): { text: string; caret: number } {
  if (insideUnit(before)) return { text: name, caret: name.length };
  return { text: `[${name}]`, caret: name.length + 1 };
}

/** `[` after a value or `in` opens a unit. `[` in any other place opens a list. */
export function opensUnit(before: string): boolean {
  const trimmed = before.trimEnd();
  if (/(?:^|\s)in$/.test(trimmed)) return true;
  return /[\w)\]]$/.test(trimmed);
}
