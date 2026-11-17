import { CORE_NAMES, opensUnit } from "./complete";

/** A colored range. It runs until the next paint, or the end of the line. */
export interface Paint {
  start: number;
  tone: "comment" | "heading" | "marker" | "prose" | "function" | "variable" | "number" | "operator" | "unit";
}

const CORE = new Set<string>(CORE_NAMES);

/**
 * Colors one physical line. A continued statement stays mathematics even when
 * the line starts with a heading or paragraph marker.
 */
export function paintLine(line: string, continued = false): Paint[] {
  if (continued || isStatement(line)) {
    const paints: Paint[] = [];
    scanMath(line, 0, line.length, paints);
    return paints;
  }
  const indent = line.length - line.trimStart().length;
  const body = line.slice(indent);
  if (body.startsWith("//")) return [{ start: 0, tone: "comment" }];
  if (/^#{1,3} /.test(body)) return [{ start: 0, tone: "heading" }];
  const paints: Paint[] = [{ start: 0, tone: "marker" }];
  paintProse(line, indent + 3, line.length, paints);
  return paints;
}

/** The next physical line belongs to this statement when this line ends in `\`. */
export function statementContinues(line: string, continued = false): boolean {
  if (!continued && !isStatement(line)) return false;
  return line.replace(/[ \t]+$/, "").endsWith("\\");
}

function isStatement(line: string): boolean {
  const body = line.trimStart();
  if (body === "") return false;
  if (body.startsWith("//")) return false;
  if (/^#{1,3} /.test(body)) return false;
  if (body.startsWith("-- ")) return false;
  return true;
}

function paintProse(line: string, start: number, end: number, paints: Paint[]): void {
  let i = start;
  let textAt = start;
  while (i < end) {
    if (line[i] !== "$") {
      i++;
      continue;
    }
    if (i > textAt) paints.push({ start: textAt, tone: "prose" });
    paints.push({ start: i, tone: "operator" });
    const close = line.indexOf("$", i + 1);
    const mathEnd = close === -1 ? end : close;
    scanMath(line, i + 1, mathEnd, paints);
    if (close === -1) return;
    paints.push({ start: close, tone: "operator" });
    i = close + 1;
    textAt = i;
  }
  if (textAt < end) paints.push({ start: textAt, tone: "prose" });
}

function scanMath(line: string, from: number, to: number, paints: Paint[]): void {
  const brackets: Array<"unit" | "list"> = [];
  let i = from;
  while (i < to) {
    const ch = line[i];
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === "/" && line[i + 1] === "/") {
      paints.push({ start: i, tone: "comment" });
      return;
    }
    if (isDigit(ch)) {
      const end = scanNumberEnd(line, i, to);
      paints.push({ start: i, tone: "number" });
      i = end;
      continue;
    }
    if (isLetter(ch)) {
      let end = i + 1;
      while (end < to && (isLetter(line[end]) || isDigit(line[end]) || line[end] === "_")) end++;
      paints.push({ start: i, tone: nameTone(line, i, end, to, brackets) });
      i = end;
      continue;
    }
    const two = line.slice(i, i + 2);
    if (two === ":=" || two === "<=" || two === ">=" || two === "..") {
      paints.push({ start: i, tone: "operator" });
      i += 2;
      continue;
    }
    if (ch === "[") {
      brackets.push(opensUnit(line.slice(from, i)) ? "unit" : "list");
      paints.push({ start: i, tone: "operator" });
      i++;
      continue;
    }
    if (ch === "]") {
      brackets.pop();
      paints.push({ start: i, tone: "operator" });
      i++;
      continue;
    }
    paints.push({ start: i, tone: "operator" });
    i++;
  }
}

function nameTone(
  line: string,
  start: number,
  end: number,
  limit: number,
  brackets: Array<"unit" | "list">,
): Paint["tone"] {
  if (brackets[brackets.length - 1] === "unit") return "unit";
  const text = line.slice(start, end);
  const call = isCall(line, end, limit);
  if (text === "in" && !call) return "operator";
  if (call || CORE.has(text)) return "function";
  return "variable";
}

function isCall(line: string, start: number, limit: number): boolean {
  let i = start;
  while (i < limit && (line[i] === " " || line[i] === "\t")) i++;
  return line[i] === "(";
}

function scanNumberEnd(line: string, start: number, limit: number): number {
  let i = start;
  while (i < limit && isDigit(line[i])) i++;
  if (line[i] === "." && isDigit(line[i + 1] ?? "")) {
    i++;
    while (i < limit && isDigit(line[i])) i++;
  }
  if (i < limit && (line[i] === "e" || line[i] === "E")) {
    let j = i + 1;
    if (line[j] === "+" || line[j] === "-") j++;
    if (isDigit(line[j] ?? "")) {
      i = j;
      while (i < limit && isDigit(line[i])) i++;
    }
  }
  return i;
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9";
}

function isLetter(ch: string | undefined): boolean {
  return ch !== undefined && ((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z"));
}
