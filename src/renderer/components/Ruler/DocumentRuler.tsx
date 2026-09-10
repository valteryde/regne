import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useDocument } from '../../context/DocumentContext';

const DPI = 96; // Standard 96 CSS pixels per inch

interface DocumentRulerProps {
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

export const DocumentRuler: React.FC<DocumentRulerProps> = ({ scrollRef }) => {
  const {
    zoom,
    paperWidth,
    pageMargins,
    setPageMargins,
    rulerPosition,
  } = useDocument();

  const [draggingMarker, setDraggingMarker] = useState<'left' | 'right' | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<'left' | 'right' | null>(null);
  const [scrollLeft, setScrollLeft] = useState<number>(0);

  const rulerBarRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartMarginRef = useRef<number>(0);

  // Sync ruler horizontal scroll with the document scroll container
  useEffect(() => {
    const target = scrollRef?.current;
    if (!target) return;

    const handleScroll = () => {
      setScrollLeft(target.scrollLeft);
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [scrollRef]);

  const leftMarginPx = pageMargins.left * DPI;
  const rightMarginPx = pageMargins.right * DPI;
  const totalWidthPx = paperWidth * DPI;
  const activeWidthPx = Math.max(0, totalWidthPx - leftMarginPx - rightMarginPx);

  // Drag logic for Left & Right margin markers with 1/8" magnetic snap
  const handleMarkerMouseDown = (
    e: React.MouseEvent,
    marker: 'left' | 'right'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingMarker(marker);
    dragStartXRef.current = e.clientX;
    dragStartMarginRef.current = marker === 'left' ? pageMargins.left : pageMargins.right;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaScreenPx = moveEvent.clientX - dragStartXRef.current;
      // Account for zoom level
      const deltaInches = deltaScreenPx / (DPI * zoom);

      if (marker === 'left') {
        let newMargin = dragStartMarginRef.current + deltaInches;
        // Snap to nearest 1/8 inch (0.125") unless Shift is held
        if (!moveEvent.shiftKey) {
          newMargin = Math.round(newMargin * 8) / 8;
        }
        // Clamping: minimum 0.25", maximum paperWidth - rightMargin - 1.0"
        newMargin = Math.max(0.25, Math.min(paperWidth - pageMargins.right - 1.0, newMargin));
        setPageMargins((prev) => ({ ...prev, left: Number(newMargin.toFixed(3)) }));
      } else {
        let newMargin = dragStartMarginRef.current - deltaInches;
        if (!moveEvent.shiftKey) {
          newMargin = Math.round(newMargin * 8) / 8;
        }
        newMargin = Math.max(0.25, Math.min(paperWidth - pageMargins.left - 1.0, newMargin));
        setPageMargins((prev) => ({ ...prev, right: Number(newMargin.toFixed(3)) }));
      }
    };

    const handleMouseUp = () => {
      setDraggingMarker(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Generate tick marks and labels
  const totalSubdivisions = Math.round(paperWidth * 8); // 8 ticks per inch
  const ticks = useMemo(() => {
    const items = [];
    for (let i = 0; i <= totalSubdivisions; i++) {
      const inch = i / 8;
      const x = i * (DPI / 8);
      const isEnd = i === totalSubdivisions;
      const isWhole = i % 8 === 0;
      const isHalf = i % 4 === 0 && !isWhole;
      const isQuarter = i % 2 === 0 && !isWhole && !isHalf;

      let tickHeight = 2; // 1/8"
      if (isWhole || isEnd) tickHeight = 7;
      else if (isHalf) tickHeight = 5;
      else if (isQuarter) tickHeight = 3.5;

      let label: string | null = null;
      if (isWhole || isEnd) {
        if (inch === 0) {
          label = '0';
        } else if (inch === 4) {
          label = '4" (Center)';
        } else if (isEnd) {
          label = `${inch}"`;
        } else {
          label = `${inch}"`;
        }
      }

      items.push({
        i,
        inch,
        x,
        tickHeight,
        isWhole: isWhole || isEnd,
        label,
      });
    }
    return items;
  }, [paperWidth, totalSubdivisions]);

  const isTop = rulerPosition === 'top';

  return (
    <div
      className={`w-full select-none shrink-0 bg-[var(--bg-chrome)] border-[var(--border-color)] transition-colors relative z-20 overflow-visible flex items-center justify-center ${
        isTop ? 'border-b shadow-[0_1px_2px_rgba(0,0,0,0.03)]' : 'border-t shadow-[0_-1px_2px_rgba(0,0,0,0.03)]'
      }`}
      style={{ height: '20px' }}
      role="region"
      aria-label="Document Margin & Tab Ruler"
    >
      {/* Scroll-synced Ruler Track */}
      <div
        className="h-full flex items-center justify-center w-full overflow-x-clip overflow-y-visible"
        style={{
          transform: `translateX(${-scrollLeft}px)`,
        }}
      >
        {/* Scaled Page Measurement Bar (matches document sheet width & zoom) */}
        <div
          ref={rulerBarRef}
          className="relative h-full flex items-center shadow-xs border-x border-[#c9c5c9]"
          style={{
            width: `${totalWidthPx * zoom}px`,
            transformOrigin: 'top center',
          }}
        >
          {/* Inner Container filling ruler height */}
          <div className="absolute inset-0">
            {/* 1. Left Margin Zone (Soft shaded gray) */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-[#ddd9dd] transition-all duration-75 border-r border-[#242e84]/30"
              style={{ width: `${leftMarginPx * zoom}px` }}
              title={`Left Margin: ${pageMargins.left.toFixed(2)}"`}
            />

            {/* 2. Active Printable Zone (Crisp white document sheet) */}
            <div
              className="absolute top-0 bottom-0 bg-white"
              style={{
                left: `${leftMarginPx * zoom}px`,
                width: `${activeWidthPx * zoom}px`,
              }}
            />

            {/* 3. Right Margin Zone (Soft shaded gray) */}
            <div
              className="absolute top-0 bottom-0 right-0 bg-[#ddd9dd] transition-all duration-75 border-l border-[#242e84]/30"
              style={{ width: `${rightMarginPx * zoom}px` }}
              title={`Right Margin: ${pageMargins.right.toFixed(2)}"`}
            />

            {/* 4. Measurement Scale Ticks & Labels */}
            <div className="absolute inset-0 pointer-events-none">
              {ticks.map((t) => (
                <div
                  key={t.i}
                  className="absolute inset-y-0"
                  style={{ left: `${t.x * zoom}px` }}
                >
                  {/* Tick line */}
                  <div
                    className={`absolute ${isTop ? 'bottom-0' : 'top-0'} w-px ${
                      t.isWhole ? 'bg-[#555255]' : 'bg-[#989498]'
                    }`}
                    style={{ height: `${t.tickHeight}px` }}
                  />

                  {/* Label (above/below tick depending on ruler dock position) */}
                  {t.label && (
                    <div
                      className={`absolute ${
                        isTop ? 'top-[1.5px]' : 'bottom-[1.5px]'
                      } font-mono text-[9px] leading-none whitespace-nowrap select-none font-medium tracking-tight ${
                        t.inch === 4
                          ? 'text-[#2b272b] font-semibold -translate-x-1/2'
                          : t.inch === 0
                          ? 'text-[#484448] translate-x-0.5'
                          : t.inch === 8.5
                          ? 'text-[#484448] -translate-x-full pr-0.5'
                          : 'text-[#484448] -translate-x-1/2'
                      }`}
                    >
                      {t.label}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 5. Left Margin Indicator (Royal Blue Downward Triangle ▼ & Guideline) */}
            <div
              className="absolute top-0 bottom-0 z-30 cursor-ew-resize group"
              style={{ left: `${leftMarginPx * zoom}px` }}
              onMouseDown={(e) => handleMarkerMouseDown(e, 'left')}
              onMouseEnter={() => setHoveredMarker('left')}
              onMouseLeave={() => setHoveredMarker(null)}
              title="Drag to adjust Left Margin (Shift: free drag)"
            >
              {/* Hit target extension for easy grabbing */}
              <div className="absolute -left-3 -right-3 top-0 bottom-0" />

              {/* Royal blue triangle pointer pointing towards the page */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 ${
                  isTop ? 'top-0' : 'bottom-0 rotate-180'
                } transition-transform ${
                  draggingMarker === 'left' ? 'scale-125' : 'group-hover:scale-110'
                }`}
              >
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none" className="drop-shadow-xs">
                  <path d="M4 6L0.5 0.5H7.5L4 6Z" fill="#242e84" />
                </svg>
              </div>

              {/* Vertical royal blue marker line extending down through ruler */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 ${
                  isTop ? 'top-1 bottom-0' : 'top-0 bottom-1'
                } w-[1.5px] bg-[#242e84]`}
              />

              {/* Floating measurement badge */}
              {(draggingMarker === 'left' || hoveredMarker === 'left') && (
                <div
                  className={`absolute left-1/2 -translate-x-1/2 ${
                    isTop ? 'top-full mt-1' : 'bottom-full mb-1'
                  } px-1.5 py-0.5 bg-[#242e84] text-white text-[9.5px] font-mono rounded shadow-md pointer-events-none whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-100`}
                >
                  Left: {pageMargins.left.toFixed(2)}"
                </div>
              )}
            </div>

            {/* 6. Right Margin Indicator (Royal Blue Downward Triangle ▼ & Guideline) */}
            <div
              className="absolute top-0 bottom-0 z-30 cursor-ew-resize group"
              style={{ left: `${(totalWidthPx - rightMarginPx) * zoom}px` }}
              onMouseDown={(e) => handleMarkerMouseDown(e, 'right')}
              onMouseEnter={() => setHoveredMarker('right')}
              onMouseLeave={() => setHoveredMarker(null)}
              title="Drag to adjust Right Margin (Shift: free drag)"
            >
              {/* Hit target extension */}
              <div className="absolute -left-3 -right-3 top-0 bottom-0" />

              {/* Royal blue triangle pointer pointing towards the page */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 ${
                  isTop ? 'top-0' : 'bottom-0 rotate-180'
                } transition-transform ${
                  draggingMarker === 'right' ? 'scale-125' : 'group-hover:scale-110'
                }`}
              >
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none" className="drop-shadow-xs">
                  <path d="M4 6L0.5 0.5H7.5L4 6Z" fill="#242e84" />
                </svg>
              </div>

              {/* Vertical royal blue marker line */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 ${
                  isTop ? 'top-1 bottom-0' : 'top-0 bottom-1'
                } w-[1.5px] bg-[#242e84]`}
              />

              {/* Floating measurement badge */}
              {(draggingMarker === 'right' || hoveredMarker === 'right') && (
                <div
                  className={`absolute left-1/2 -translate-x-1/2 ${
                    isTop ? 'top-full mt-1' : 'bottom-full mb-1'
                  } px-1.5 py-0.5 bg-[#242e84] text-white text-[9.5px] font-mono rounded shadow-md pointer-events-none whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-100`}
                >
                  Right: {pageMargins.right.toFixed(2)}"
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
