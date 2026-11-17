import React from "react";
import { StatementDisplay } from "../../../language/displays";
import { pageRows } from "../../../language/session";
import { PointerTarget } from "../../../language/selection";
import { KaTeXRenderer } from "../Worksheet/KaTeXRenderer";
import { readPointer } from "./pointer";

interface SheetProps {
  source: string;
  displays: StatementDisplay[];
  legacy: boolean;
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
  legacy,
  engineError,
  pending,
  paperWidth,
  zoom,
  marginLeft,
  marginRight,
  onMouseDown,
  onPointerDown,
}) => {
  const rows = pageRows(source, displays);
  const width = paperWidth * 96;

  return (
    <div
      data-regne-page
      tabIndex={-1}
      aria-label="Document"
      className="h-full overflow-auto bg-[var(--bg-canvas)] outline-none"
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        onMouseDown?.();
        onPointerDown?.(readPointer(event.target));
      }}
    >
      <div className="flex justify-center py-6 px-4" style={{ minWidth: "100%" }}>
        <div style={{ width: width * zoom }}>
          <article
            className="bg-white border border-[var(--border-color)] text-[var(--text-primary)]"
            style={{
              width,
              minHeight: "11in",
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              paddingLeft: marginLeft * 96,
              paddingRight: marginRight * 96,
              paddingTop: "2.5rem",
              paddingBottom: "4rem",
            }}
          >
            {legacy && (
              <p data-regne-legacy className="font-serif text-base mb-4">
                This file is a legacy document. It stays as text until it can be imported.
              </p>
            )}
            {engineError && (
              <p data-regne-engine className="text-sm text-red-700 mb-4">
                {engineError}
              </p>
            )}
            {pending && rows.length === 0 && !legacy && (
              <p className="text-sm text-[var(--text-muted)]">Computing…</p>
            )}
            {rows.map((row) => {
              if (row.kind === "gap") {
                return <div key={`gap-${row.start}`} className="h-4" />;
              }
              if (row.kind === "raw") {
                return (
                  <p
                    key={`raw-${row.start}`}
                    data-regne-row
                    data-regne-kind="raw"
                    className="font-serif text-[15px] leading-relaxed whitespace-pre-wrap my-2"
                  >
                    {row.text}
                  </p>
                );
              }
              const display = row.display;
              return (
                <div
                  key={`display-${row.start}`}
                  data-regne-row
                  data-regne-kind="display"
                  data-regne-start={row.start}
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
            })}
          </article>
        </div>
      </div>
    </div>
  );
};
