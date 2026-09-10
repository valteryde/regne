import React, { useRef, useEffect, useState, memo } from 'react';
import { ChevronDown, ChevronRight, Hash, Bookmark, BookOpen, MoreHorizontal } from 'lucide-react';
import { SectionKind } from '../../../types/document';

interface SectionLineProps {
  id: string;
  index: number;
  title: string;
  level: 1 | 2 | 3;
  kind?: SectionKind;
  collapsed?: boolean;
  numberLabel: string;
  elementCount: number;
  isActive: boolean;
  isSelected: boolean;
  onFocus: () => void;
  onChangeTitle: (newTitle: string) => void;
  onChangeLevel: (level: 1 | 2 | 3, kind?: SectionKind) => void;
  onToggleCollapse: () => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onRowMouseDown: (e: React.MouseEvent) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}

export const SectionLine: React.FC<SectionLineProps> = memo(({
  id,
  index,
  title,
  level,
  kind = 'section',
  collapsed = false,
  numberLabel,
  elementCount,
  isActive,
  isSelected,
  onFocus,
  onChangeTitle,
  onChangeLevel,
  onToggleCollapse,
  onEnter,
  onBackspaceEmpty,
  onNavigateUp,
  onNavigateDown,
  onRowMouseDown,
  registerRef,
}) => {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  // Sync title from state only when not actively typing into this element
  useEffect(() => {
    if (elRef.current && document.activeElement !== elRef.current) {
      if (elRef.current.innerText !== title) {
        elRef.current.innerText = title;
      }
    }
  }, [title]);

  useEffect(() => {
    if (elRef.current) {
      elRef.current.innerText = title;
    }
  }, []);

  const isTheorem = kind === 'theorem';
  const isLemma = kind === 'lemma';
  const isDefinition = kind === 'definition';

  return (
    <div
      data-element-id={id}
      data-element-idx={index}
      className={`group/sec relative py-1 px-1 transition-colors select-text ${
        isSelected ? 'bg-[var(--selection-bg)] maple-selected' : 'bg-transparent'
      }`}
      onMouseDown={onRowMouseDown}
      onClick={() => {
        if (!isSelected) {
          onFocus();
          elRef.current?.focus();
        }
      }}
    >
      {/* Section Container based on Level / Kind */}
      <div
        className={`flex items-baseline gap-2.5 transition-all ${
          level === 1
            ? 'mt-6 mb-2 border-b border-[var(--border-color)] pb-2'
            : isTheorem || isLemma
            ? 'mt-4 mb-2 p-2.5 rounded-sm border-l-4 bg-slate-50 dark:bg-slate-900/40 ' +
              (isTheorem ? 'border-[#242e84]' : 'border-indigo-600')
            : level === 2
            ? 'mt-4 mb-1.5 pl-2'
            : 'mt-2 mb-1 pl-4'
        }`}
      >
        {/* Collapse / Expand Toggle Button */}
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="w-5 h-5 -ml-1 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer shrink-0 select-none self-center"
          title={collapsed ? `Expand Section (${elementCount} elements)` : 'Collapse Section'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-[#242e84]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)] group-hover/sec:text-[var(--text-primary)]" />
          )}
        </button>

        {/* Section Prefix Badge / Kind Selector */}
        <div className="relative inline-flex items-center shrink-0 select-none">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setShowTypeMenu((v) => !v);
            }}
            className={`cursor-pointer font-serif rounded transition-colors hover:ring-1 hover:ring-[var(--border-color)] ${
              level === 1
                ? 'text-xl font-bold text-[#242e84] pr-1'
                : isTheorem
                ? 'text-sm font-bold text-[#242e84] uppercase tracking-wide bg-blue-100/70 px-1.5 py-0.5 rounded'
                : isLemma
                ? 'text-sm font-bold text-indigo-700 uppercase tracking-wide bg-indigo-100/70 px-1.5 py-0.5 rounded'
                : level === 2
                ? 'text-lg font-semibold text-[#242e84] pr-1'
                : 'text-base font-medium italic text-slate-600 pr-1'
            }`}
            title="Click to change section style"
          >
            {numberLabel}
          </button>

          {/* Type Menu Dropdown */}
          {showTypeMenu && (
            <div
              className="absolute left-0 top-full mt-1 w-44 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded shadow-lg py-1 z-50 text-xs font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  onChangeLevel(1, 'section');
                  setShowTypeMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-subtle)] flex items-center gap-2"
              >
                <span className="font-serif font-bold text-[#242e84]">§</span>
                <span>Section (Level 1)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeLevel(2, 'subsection');
                  setShowTypeMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-subtle)] flex items-center gap-2"
              >
                <span className="font-serif font-semibold text-[#242e84]">§§</span>
                <span>Subsection (Level 2)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeLevel(2, 'theorem');
                  setShowTypeMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-subtle)] flex items-center gap-2"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#242e84]" />
                <span>Theorem</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeLevel(2, 'lemma');
                  setShowTypeMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-subtle)] flex items-center gap-2"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Lemma</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeLevel(3, 'subsubsection');
                  setShowTypeMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-subtle)] flex items-center gap-2"
              >
                <span className="font-serif italic text-slate-600">§§§</span>
                <span>Subsubsection (Level 3)</span>
              </button>
            </div>
          )}
        </div>

        {/* Editable Title */}
        <div
          ref={(r) => {
            elRef.current = r;
            registerRef(r);
          }}
          contentEditable={true}
          suppressContentEditableWarning={true}
          onFocus={onFocus}
          onInput={(e) => {
            onChangeTitle(e.currentTarget.innerText);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onEnter();
            } else if (e.key === 'Backspace') {
              const text = e.currentTarget.innerText.trim();
              if (text === '') {
                e.preventDefault();
                onBackspaceEmpty();
              }
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              onNavigateUp();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              onNavigateDown();
            }
          }}
          className={`flex-1 outline-none font-serif text-[var(--text-primary)] select-text empty:before:content-['Section_title...'] empty:before:text-[var(--text-muted)] ${
            level === 1
              ? 'text-xl font-bold tracking-tight'
              : isTheorem || isLemma
              ? 'text-base font-semibold'
              : level === 2
              ? 'text-lg font-semibold'
              : 'text-base font-medium italic'
          }`}
        />
      </div>
    </div>
  );
});

SectionLine.displayName = 'SectionLine';
