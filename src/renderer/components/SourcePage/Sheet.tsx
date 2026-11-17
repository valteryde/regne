import React, { useLayoutEffect, useRef, useState } from "react";
import { Span } from "../../../language/ast";
import { FreshValue, StatementDisplay } from "../../../language/displays";
import { PageBlock, pageDocument } from "../../../language/page";
import { PointerTarget } from "../../../language/selection";
import { CSS_DPI, sheetScale } from "../../utils/pageGeometry";
import { KaTeXRenderer } from "../Worksheet/KaTeXRenderer";
import { readPointer } from "./pointer";

interface SheetProps {
  source: string;
  displays: StatementDisplay[];
  selection: Span | null;
  inlineValues: ReadonlyMap<number, FreshValue>;
  legacy: boolean;
  notice: string | null;
  engineError: string | null;
  pending: boolean;
  paperWidth: number;
  zoom: number;
  marginLeft: number;
  marginRight: number;
  onMouseDown?: () => void;
  onPointerDown?: (pointer: PointerTarget) => void;
}

export const Sheet: React.FC<SheetProps> = ({
  source,
  displays,
  selection,
  inlineValues,
  legacy,
  notice,
  engineError,
  pending,
  paperWidth,
  zoom,
  marginLeft,
  marginRight,
  onMouseDown,
  onPointerDown,
}) => {
  const blocks = pageDocument(source, displays, selection, inlineValues);
  const width = paperWidth * CSS_DPI;
  const pageRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const measure = () => {
      const next = page.offsetWidth;
      setFrameWidth((prev) => (prev === next ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const measure = () => {
      const next = article.offsetHeight;
      setSheetHeight((prev) => (prev === next ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(article);
    return () => observer.disconnect();
  }, []);

  const scale = sheetScale(frameWidth, width, zoom);
  const fittedWidth = Math.ceil(width * scale);
  const fittedHeight = Math.ceil(sheetHeight * scale);

  return (
    <div
      ref={pageRef}
      data-regne-page
      tabIndex={-1}
      aria-label="Document"
      className="h-full min-h-0 overflow-auto bg-[var(--bg-canvas)] outline-none"
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        onMouseDown?.();
        onPointerDown?.(readPointer(event.target));
      }}
    >
      <div className="py-6" style={{ width: "fit-content", marginInline: "auto" }}>
        <div className="relative overflow-hidden" style={{ width: fittedWidth, height: fittedHeight }}>
          <article
            ref={articleRef}
            className="absolute top-0 left-0 bg-white border border-[var(--border-color)] text-[var(--page-ink)]"
            style={{
              width,
              minHeight: "11in",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              paddingLeft: marginLeft * CSS_DPI,
              paddingRight: marginRight * CSS_DPI,
              paddingTop: "2.5rem",
              paddingBottom: "4rem",
            }}
          >
            {notice && (
              <p data-regne-import className="font-serif text-sm mb-4 text-[var(--page-muted)]">
                {notice}
              </p>
            )}
            {legacy && !notice && (
              <p data-regne-legacy className="font-serif text-base mb-4">
                This file is a legacy document. It stays as text until it can be imported.
              </p>
            )}
            {engineError && (
              <p data-regne-engine className="text-sm text-red-700 mb-4">
                {engineError}
              </p>
            )}
            {pending && blocks.length === 0 && !legacy && (
              <p className="text-sm text-[var(--page-muted)]">Computing…</p>
            )}
            {blocks.map((block) => (
              <BlockView key={`${block.kind}-${block.start}`} block={block} />
            ))}
          </article>
        </div>
      </div>
    </div>
  );
};

const BlockView: React.FC<{ block: PageBlock }> = ({ block }) => {
  if (block.kind === "gap") {
    return <div data-regne-start={block.start} data-regne-end={block.end} className="h-4" />;
  }
  if (block.kind === "heading") {
    const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
    const size = block.level === 1 ? "text-2xl" : block.level === 2 ? "text-xl" : "text-lg";
    return (
      <Tag
        data-regne-row
        data-regne-kind="heading"
        data-regne-start={block.start}
        data-regne-end={block.end}
        data-regne-caret={block.caret}
        className={`font-serif ${size} leading-tight mt-2 mb-3`}
      >
        {block.title}
      </Tag>
    );
  }
  if (block.kind === "paragraph") {
    return (
      <p
        data-regne-row
        data-regne-kind="paragraph"
        data-regne-start={block.start}
        data-regne-end={block.end}
        data-regne-caret={block.caret}
        className="font-serif text-[15px] leading-7 my-2"
      >
        {block.parts.map((part, index) => {
          if (part.kind === "text") return <span key={index}>{part.text}</span>;
          return (
            <span key={index} className="regne-input" data-span={`${part.span.start}:${part.span.end}`}>
              <KaTeXRenderer math={part.latex} inline className="regne-inline" />
              {part.valueLatex ? (
                <KaTeXRenderer math={`= ${part.valueLatex}`} inline className="regne-inline-value" />
              ) : null}
            </span>
          );
        })}
      </p>
    );
  }
  const display = block.display;
  return (
    <div
      data-regne-row
      data-regne-kind="display"
      data-regne-start={block.start}
      data-regne-end={block.end}
      data-regne-caret={block.caret}
      data-stale={display?.stale ? "true" : "false"}
      className="my-3"
    >
      {display?.inputLatex ? (
        <KaTeXRenderer math={display.inputLatex} className="regne-input" />
      ) : null}
      {display?.valueSvg ? (
        <div data-regne-plot className="my-2" dangerouslySetInnerHTML={{ __html: display.valueSvg }} />
      ) : display?.valueLatex ? (
        <div data-regne-value>
          <KaTeXRenderer math={display.valueLatex} />
        </div>
      ) : null}
      {display?.error ? (
        <p data-regne-error className="text-sm text-red-700 mt-1">
          {display.error}
        </p>
      ) : null}
    </div>
  );
};
