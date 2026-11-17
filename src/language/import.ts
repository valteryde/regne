import { isLegacyDocument } from "./document";
import { ParseError, parseStatement } from "./parse";

export interface LegacyImport {
  text: string;
  /** What was dropped, in the order it was noticed. */
  notes: string[];
}

interface LegacyElement {
  type?: string;
  title?: string;
  level?: number;
  kind?: string;
  content?: string;
  input?: string;
}

/**
 * A leading `{` file is the old JSON document.
 * Text becomes paragraphs, sections become headings, and math that is already
 * the text language stays a statement. LaTeX is left as a comment.
 */
export function importLegacy(source: string): LegacyImport {
  if (!isLegacyDocument(source)) return { text: source, notes: [] };
  let elements: LegacyElement[] = [];
  try {
    const parsed = JSON.parse(source) as { elements?: LegacyElement[] };
    elements = Array.isArray(parsed.elements) ? parsed.elements : [];
  } catch {
    return {
      text: "// This file started with { but it is not a document.\n",
      notes: ["This file could not be read as a legacy document."],
    };
  }
  const notes: string[] = [];
  const lines: string[] = [];
  let droppedFormatting = false;
  for (const element of elements) {
    if (element.type === "section") {
      const level = element.level === 2 ? "##" : element.level === 3 ? "###" : "#";
      const title = (element.title || "Untitled").replace(/\s+/g, " ").trim() || "Untitled";
      lines.push(`${level} ${title}`);
      const kind = element.kind || "section";
      if (kind !== "section" && kind !== "subsection" && kind !== "subsubsection") {
        notes.push(`A ${kind} became a heading: ${title}`);
      }
      continue;
    }
    if (element.type === "text") {
      const raw = element.content || "";
      if (/<[^>]+>/.test(raw)) droppedFormatting = true;
      const plain = stripTags(raw);
      for (const line of plain.split(/\r?\n/)) {
        const sentence = line.trim();
        if (sentence) lines.push(`- ${sentence}`);
      }
      continue;
    }
    if (element.type === "math") {
      const input = (element.input || "").trim();
      if (!input) continue;
      if (parses(input)) {
        lines.push(input);
        continue;
      }
      notes.push(`Left a formula as a comment. It is not the text language: ${input.slice(0, 48)}`);
      lines.push(`// ${input.replace(/\s+/g, " ")}`);
    }
  }
  if (droppedFormatting) notes.unshift("Text formatting was dropped.");
  if (lines.length === 0) lines.push("");
  return { text: `${lines.join("\n")}\n`, notes };
}

function parses(source: string): boolean {
  try {
    parseStatement(source);
    return true;
  } catch (error) {
    if (error instanceof ParseError) return false;
    throw error;
  }
}

function stripTags(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
