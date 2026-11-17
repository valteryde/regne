export const CSS_DPI = 96;

/** Space kept around the sheet so it can center in the scroller. */
export const PAGE_GUTTER_PX = 48;

export function zoomedPageWidth(paperWidthInches: number, zoom: number): number {
  return paperWidthInches * CSS_DPI * zoom;
}

/**
 * Paper size times the user's zoom, capped so zoom 1 stays inside the frame.
 * A zoom above 1 can grow past the frame; the scroller then reaches both edges.
 */
export function sheetScale(frameWidth: number, paperWidthPx: number, zoom: number): number {
  if (!(frameWidth > PAGE_GUTTER_PX) || !(paperWidthPx > 0)) return zoom;
  const fit = Math.min(1, (frameWidth - PAGE_GUTTER_PX) / paperWidthPx);
  return fit * zoom;
}

/**
 * Left edge of the sheet inside the scrollport, in scrollport pixels.
 * The sheet is centered in a box that is at least the viewport and at least
 * the sheet plus PAGE_GUTTER_PX.
 */
export function pageLeftInScroller(
  scrollWidth: number,
  clientWidth: number,
  scrollLeft: number,
  pageWidth: number,
): number {
  const contentWidth = Math.max(scrollWidth, clientWidth, pageWidth + PAGE_GUTTER_PX);
  return (contentWidth - pageWidth) / 2 - scrollLeft;
}
