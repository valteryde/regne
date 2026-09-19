// ---------------------------------------------------------------------------
// Caret geometry helpers for contentEditable lines.
// Shared by TextLine, SectionLine and the document-level keyboard handler.
// ---------------------------------------------------------------------------

// True when the caret sits on the first visual line of `el`.
export const caretOnFirstLine = (el: HTMLElement): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const caret = sel.getRangeAt(0).getBoundingClientRect();
  if (caret.top === 0 && caret.bottom === 0) return true;
  const probe = document.createRange();
  probe.selectNodeContents(el);
  probe.collapse(true);
  const first = probe.getBoundingClientRect();
  if (first.top === 0) return true;
  const lineH = parseFloat(getComputedStyle(el).lineHeight) || 20;
  return caret.top - first.top < lineH * 0.6;
};

// True when the caret sits on the last visual line of `el`.
export const caretOnLastLine = (el: HTMLElement): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const caret = sel.getRangeAt(0).getBoundingClientRect();
  if (caret.top === 0 && caret.bottom === 0) return true;
  const probe = document.createRange();
  probe.selectNodeContents(el);
  probe.collapse(false);
  const last = probe.getBoundingClientRect();
  if (last.bottom === 0) return true;
  const lineH = parseFloat(getComputedStyle(el).lineHeight) || 20;
  return last.bottom - caret.bottom < lineH * 0.6;
};

// True when a collapsed caret is at the very start of `el`.
// A leading <br> or image still counts as content before the caret.
export const caretAtStart = (el: HTMLElement): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const r = document.createRange();
  r.selectNodeContents(el);
  try {
    r.setEnd(range.startContainer, range.startOffset);
  } catch {
    return false;
  }
  const frag = r.cloneContents();
  return (frag.textContent || '').length === 0 && !frag.querySelector('br,img');
};

// True when a collapsed caret is at the very end of `el`.
export const caretAtEnd = (el: HTMLElement): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const r = document.createRange();
  r.selectNodeContents(el);
  try {
    r.setStart(range.endContainer, range.endOffset);
  } catch {
    return false;
  }
  const frag = r.cloneContents();
  return (frag.textContent || '').length === 0 && !frag.querySelector('br,img');
};

// Place a collapsed caret `offset` text characters into `el`.
export const placeCaretAtCharOffset = (el: HTMLElement, offset: number): void => {
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length || 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= len;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
};

// True when the DOM selection covers the entire contents of `el`.
export const selectionCoversAll = (el: HTMLElement): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  const full = document.createRange();
  full.selectNodeContents(el);
  return (
    range.compareBoundaryPoints(Range.START_TO_START, full) <= 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, full) >= 0
  );
};

// Character length of the text contained in an HTML string (<br> counts 0).
export const htmlTextLength = (html: string): number => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || '').length;
};
