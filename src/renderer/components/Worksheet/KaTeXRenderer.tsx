import React, { useMemo } from 'react';
import katex from 'katex';

interface KaTeXRendererProps {
  math: string;
  displayMode?: boolean;
  className?: string;
}

export const KaTeXRenderer: React.FC<KaTeXRendererProps> = ({
  math,
  displayMode = true,
  className = '',
}) => {
  const html = useMemo(() => {
    try {
      const trimmed = (math || '').trim();
      const processedMath =
        !displayMode && trimmed && !trimmed.startsWith('\\displaystyle') && !trimmed.startsWith('\\textstyle')
          ? `\\displaystyle ${trimmed}`
          : trimmed;

      return katex.renderToString(processedMath, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch (err: any) {
      return `<span class="text-red-500 font-mono text-sm">${math}</span>`;
    }
  }, [math, displayMode]);

  return (
    <div
      className={`maple-output select-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
