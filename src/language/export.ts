import { Block, readDocument } from "./document";
import { toLatex } from "./toLatex";

const SECTION = ["\\section", "\\subsection", "\\subsubsection"] as const;

/** LaTeX for the file. Highlight wrappers are not part of it. */
export function exportLatex(source: string): string {
  const file = readDocument(source);
  const body = file.legacy
    ? ""
    : file.blocks
        .map((block) => blockLatex(source, block))
        .filter((part) => part.length > 0)
        .join("\n\n");
  return `\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n${body}\n\\end{document}\n`;
}

function blockLatex(source: string, block: Block): string {
  if (block.kind === "blank" || block.kind === "comment") return "";
  if (block.kind === "heading") {
    return `${SECTION[block.level - 1]}{${escapeText(block.title)}}`;
  }
  if (block.kind === "paragraph") return paragraphLatex(source, block);
  if (!block.parsed) return "";
  return `\\[\n${toLatex(block.parsed.node, null, false)}\n\\]`;
}

function paragraphLatex(source: string, block: Extract<Block, { kind: "paragraph" }>): string {
  const origin = textOrigin(source, block);
  let cursor = 0;
  let text = "";
  for (const math of block.math) {
    const start = math.span.start - origin;
    const end = math.span.end - origin;
    if (start > cursor) text += escapeText(block.text.slice(cursor, start));
    if (math.parsed) text += `$${toLatex(math.parsed.node, null, false)}$`;
    else text += escapeText(block.text.slice(start, end));
    cursor = end;
  }
  if (cursor < block.text.length) text += escapeText(block.text.slice(cursor));
  return text;
}

function textOrigin(source: string, block: Extract<Block, { kind: "paragraph" }>): number {
  let origin = block.marker.end;
  if (source[origin] === " ") origin += 1;
  return origin;
}

export function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}
