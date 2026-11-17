import { Span } from "./ast";
import { ParseError, Parsed, parseStatement } from "./parse";

export const CYLINDER_NOTE = `# Charge in a cylinder

- The holdup is fixed. Pressure and volume are measured.
n := 2 [mol]
P := 10 [bar]
V := 66 [L]
R := 8.314 [J/(mol*K)]
T = P*V / (n*R)

- The temperature follows from the ideal gas law.
`;

export interface InlineMath {
  source: string;
  span: Span;
  parsed: Parsed | null;
  error: ParseError | null;
}

export type Block =
  | { kind: "blank"; span: Span }
  | { kind: "comment"; span: Span }
  | { kind: "heading"; level: 1 | 2 | 3; title: string; span: Span; marker: Span }
  | { kind: "paragraph"; text: string; span: Span; marker: Span; math: InlineMath[] }
  | { kind: "statement"; source: string; span: Span; parsed: Parsed | null; error: ParseError | null };

export interface RegneFile {
  legacy: boolean;
  blocks: Block[];
}

export function isLegacyDocument(source: string): boolean {
  return source.trimStart().startsWith("{");
}

export function readDocument(source: string): RegneFile {
  if (isLegacyDocument(source)) return { legacy: true, blocks: [] };
  return { legacy: false, blocks: classify(source) };
}

export function statementsIn(file: RegneFile): Extract<Block, { kind: "statement" }>[] {
  return file.blocks.filter((block): block is Extract<Block, { kind: "statement" }> => block.kind === "statement");
}

interface Line {
  text: string;
  start: number;
  end: number;
}

function classify(source: string): Block[] {
  const lines = splitLines(source);
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const body = line.text.trimStart();
    const contentStart = line.start + (line.text.length - body.length);

    if (body === "") {
      blocks.push({ kind: "blank", span: { start: line.start, end: line.end } });
      continue;
    }
    if (body.startsWith("//")) {
      blocks.push({ kind: "comment", span: { start: line.start, end: line.end } });
      continue;
    }
    const heading = /^(#{1,3}) (.*)$/.exec(body);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3;
      blocks.push({
        kind: "heading",
        level,
        title: heading[2],
        span: { start: line.start, end: line.end },
        marker: { start: contentStart, end: contentStart + level },
      });
      continue;
    }
    if (body.startsWith("-")) {
      blocks.push(paragraph(line, contentStart, body));
      continue;
    }

    let last = i;
    while (last < lines.length - 1 && continues(lines[last].text)) last++;
    const start = line.start;
    const end = lines[last].end;
    blocks.push(statement(source.slice(start, end), start, end));
    i = last;
  }
  return blocks;
}

function paragraph(line: Line, contentStart: number, body: string): Extract<Block, { kind: "paragraph" }> {
  let text = body.slice(1);
  let textStart = contentStart + 1;
  if (text.startsWith(" ")) {
    text = text.slice(1);
    textStart += 1;
  }
  return {
    kind: "paragraph",
    text,
    span: { start: line.start, end: line.end },
    marker: { start: contentStart, end: contentStart + 1 },
    math: inlineMath(text, textStart),
  };
}

function statement(source: string, start: number, end: number): Extract<Block, { kind: "statement" }> {
  try {
    return {
      kind: "statement",
      source,
      span: { start, end },
      parsed: parseStatement(source, start),
      error: null,
    };
  } catch (error) {
    if (error instanceof ParseError) {
      return { kind: "statement", source, span: { start, end }, parsed: null, error };
    }
    throw error;
  }
}

function inlineMath(text: string, base: number): InlineMath[] {
  const found: InlineMath[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "$") continue;
    const close = text.indexOf("$", i + 1);
    if (close === -1) break;
    const source = text.slice(i + 1, close);
    const origin = base + i + 1;
    let parsed: Parsed | null = null;
    let error: ParseError | null = null;
    try {
      parsed = parseStatement(source, origin);
    } catch (caught) {
      if (caught instanceof ParseError) error = caught;
      else throw caught;
    }
    found.push({
      source,
      span: { start: base + i, end: base + close + 1 },
      parsed,
      error,
    });
    i = close;
  }
  return found;
}

function continues(text: string): boolean {
  return text.replace(/[ \t]+$/, "").endsWith("\\");
}

function splitLines(source: string): Line[] {
  if (source.length === 0) return [];
  const lines: Line[] = [];
  let start = 0;
  for (let i = 0; i <= source.length; i++) {
    const atEnd = i === source.length;
    if (!atEnd && source[i] !== "\n") continue;
    if (atEnd && start === source.length && source.endsWith("\n")) break;
    let end = i;
    if (end > start && source[end - 1] === "\r") end -= 1;
    lines.push({ text: source.slice(start, end), start, end });
    start = i + 1;
  }
  return lines;
}
