import React, { useState } from 'react';
import { CommonSymbols } from './CommonSymbols';
import { CalculusPalette } from './CalculusPalette';
import { GreekPalette } from './GreekPalette';
import { MatrixPalette } from './MatrixPalette';
import {
  ChevronDown,
  ChevronRight,
  Calculator,
  Sigma,
  Pi,
  Grid3X3,
  Search,
} from 'lucide-react';
import { useDocument } from '../../context/DocumentContext';

interface PaletteSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const PaletteSection: React.FC<PaletteSectionProps> = ({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}) => (
  <div className="border-b border-[var(--border-color)]">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-2 hover:bg-[var(--bg-subtle)] text-left text-xs font-semibold text-[var(--text-primary)] select-none transition-colors"
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span>{title}</span>
      </div>
      {isOpen ? (
        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      ) : (
        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      )}
    </button>
    {isOpen && <div className="bg-[var(--bg-surface)]">{children}</div>}
  </div>
);

export const PaletteDrawer: React.FC = () => {
  const { insertAtCursor } = useDocument();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    symbols: true,
    calculus: true,
    greek: false,
    matrix: false,
    algebra: false,
  });

  const [searchTerm, setSearchTerm] = useState('');

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const algebraFunctions = [
    { label: 'expand', snippet: 'expand();' },
    { label: 'factor', snippet: 'factor();' },
    { label: 'solve', snippet: 'solve( = 0, x);' },
    { label: 'simplify', snippet: 'simplify();' },
    { label: 'evalf', snippet: 'evalf();' },
    { label: 'subs', snippet: 'subs(x = 1, expr);' },
    { label: 'plot', snippet: 'plot(sin(x), x = -10 .. 10);' },
    { label: 'restart', snippet: 'restart;' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none overflow-hidden bg-[var(--bg-chrome)] transition-colors">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-chrome)] flex items-center justify-between">
        <div className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5 text-[#242e84]" />
          <span>Palettes</span>
        </div>
      </div>

      {/* Quick Search */}
      <div className="p-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search symbols & templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-2.5 py-1 text-xs bg-[var(--bg-subtle)]/60 rounded border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-hidden focus:border-[#242e84]"
          />
        </div>
      </div>

      {/* Accordion container */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg-chrome)]">
        <PaletteSection
          title="Common Symbols"
          icon={<Sigma className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
          isOpen={openSections['symbols']}
          onToggle={() => toggleSection('symbols')}
        >
          <CommonSymbols />
        </PaletteSection>

        <PaletteSection
          title="Calculus & Analysis"
          icon={<Calculator className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
          isOpen={openSections['calculus']}
          onToggle={() => toggleSection('calculus')}
        >
          <CalculusPalette />
        </PaletteSection>

        <PaletteSection
          title="Greek Alphabet"
          icon={<Pi className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
          isOpen={openSections['greek']}
          onToggle={() => toggleSection('greek')}
        >
          <GreekPalette />
        </PaletteSection>

        <PaletteSection
          title="Matrices & Vectors"
          icon={<Grid3X3 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
          isOpen={openSections['matrix']}
          onToggle={() => toggleSection('matrix')}
        >
          <MatrixPalette />
        </PaletteSection>

        <PaletteSection
          title="Standard CAS Commands"
          icon={<Calculator className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
          isOpen={openSections['algebra']}
          onToggle={() => toggleSection('algebra')}
        >
          <div className="grid grid-cols-2 gap-1 p-2 font-mono text-xs">
            {algebraFunctions.map((fn, idx) => (
              <button
                key={idx}
                onClick={() => insertAtCursor(fn.snippet)}
                className="p-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] text-left truncate transition-colors font-mono text-[11px]"
                title={`Insert ${fn.snippet}`}
              >
                {fn.label}()
              </button>
            ))}
          </div>
        </PaletteSection>
      </div>

      {/* Footer hint */}
      <div className="p-2 border-t border-[var(--border-color)] bg-[var(--bg-chrome)] text-[11px] font-mono text-[var(--text-muted)] text-center">
        Click items to insert into active prompt
      </div>
    </div>
  );
};
