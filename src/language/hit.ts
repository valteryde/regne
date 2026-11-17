import { Node, Span, children } from "./ast";
import { Parsed } from "./parse";

/**
 * The smallest node that contains the selection.
 * A caret on whitespace hits nothing, including spaces a parent span covers.
 * A caret at the end of the statement hits the glyph on its left.
 */
export function hitNode(parsed: Parsed, selection: Span): Node | null {
  const start = selection.start - parsed.base;
  const end = selection.end - parsed.base;
  if (start < 0 || end > parsed.source.length || end < start) return null;
  if (insideComment(parsed.comments, selection)) return null;

  if (start === end) {
    if (start === parsed.source.length) {
      if (parsed.source.length === 0 || isWhitespace(parsed.source[parsed.source.length - 1])) {
        return null;
      }
      return deepestEndingAt(parsed.node, selection.start);
    }
    if (isWhitespace(parsed.source[start])) return null;
    return deepestContainingPoint(parsed.node, selection.start);
  }

  if (isOnlyWhitespace(parsed.source, start, end)) return null;
  return deepestContainingRange(parsed.node, selection);
}

function insideComment(comments: Span[], selection: Span): boolean {
  return comments.some(
    (comment) => comment.start <= selection.start && selection.end <= comment.end && comment.start < comment.end,
  );
}

function deepestContainingPoint(node: Node, point: number): Node | null {
  if (!(node.span.start <= point && point < node.span.end)) return null;
  for (const child of children(node)) {
    const hit = deepestContainingPoint(child, point);
    if (hit) return hit;
  }
  return node;
}

function deepestContainingRange(node: Node, selection: Span): Node | null {
  if (!(node.span.start <= selection.start && node.span.end >= selection.end)) return null;
  for (const child of children(node)) {
    const hit = deepestContainingRange(child, selection);
    if (hit) return hit;
  }
  return node;
}

function deepestEndingAt(node: Node, point: number): Node | null {
  if (node.span.end !== point) return null;
  for (const child of children(node)) {
    const hit = deepestEndingAt(child, point);
    if (hit) return hit;
  }
  return node;
}

function isOnlyWhitespace(source: string, start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    if (!isWhitespace(source[i])) return false;
  }
  return true;
}

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\v";
}
