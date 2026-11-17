/** The painted block whose file span contains this offset. */
export function blockForOffset(page: ParentNode, offset: number): HTMLElement | null {
  const rows = [...page.querySelectorAll<HTMLElement>("[data-regne-start]")];
  let nearest: HTMLElement | null = null;
  for (const row of rows) {
    const start = Number(row.getAttribute("data-regne-start"));
    const end = Number(row.getAttribute("data-regne-end"));
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start <= offset && offset <= end) return row;
    if (start <= offset) nearest = row;
  }
  return nearest ?? rows[0] ?? null;
}

/** The block at the top edge of the page scroller. */
export function blockAtTop(page: HTMLElement): HTMLElement | null {
  const edge = page.getBoundingClientRect().top + 4;
  const rows = [...page.querySelectorAll<HTMLElement>("[data-regne-start]")];
  for (const row of rows) {
    if (row.getBoundingClientRect().bottom > edge) return row;
  }
  return rows[rows.length - 1] ?? null;
}

/** Scroll only the page, and only when the block is outside it. */
export function scrollBlockIntoPage(page: HTMLElement, block: HTMLElement): void {
  const view = page.getBoundingClientRect();
  const rect = block.getBoundingClientRect();
  if (rect.top >= view.top && rect.bottom <= view.bottom) return;
  const delta = rect.top < view.top ? rect.top - view.top : rect.bottom - view.bottom;
  page.scrollTop += delta;
}
