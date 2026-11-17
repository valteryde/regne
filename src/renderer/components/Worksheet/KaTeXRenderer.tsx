import React, { useMemo } from 'react';
import katex from 'katex';

interface KaTeXRendererProps {
  math: string;
  displayMode?: boolean;
  /** A sentence fragment. Display math stays a block. */
  inline?: boolean;
  className?: string;
}

export const KaTeXRenderer: React.FC<KaTeXRendererProps> = ({
  math,
  displayMode = true,
  inline = false,
  className = '',
}) => {
  const html = useMemo(() => {
    try {
      const trimmed = (math || '').trim();
      const processedMath =
        !inline && !displayMode && trimmed && !trimmed.startsWith('\\displaystyle') && !trimmed.startsWith('\\textstyle')
          ? `\\displaystyle ${trimmed}`
          : trimmed;

      return katex.renderToString(processedMath, {
        displayMode: inline ? false : displayMode,
        throwOnError: false,
        strict: false,
        output: "html",
        trust: (context) => context.command === "\\htmlClass" || context.command === "\\htmlData",
      });
    } catch (err: any) {
      return `<span class="text-red-500 font-mono text-sm">${math}</span>`;
    }
  }, [math, displayMode, inline]);

  const Tag = inline ? "span" : "div";
  return (
    <Tag
      className={`${inline ? "" : "maple-output"} select-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
