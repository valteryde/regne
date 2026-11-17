import React, { useEffect, useRef, useState } from 'react';
import {
  FileCode,
  FilePlus,
  FileText,
  FolderOpen,
  ListTree,
  Power,
  Redo2,
  Save,
  Scale,
  Settings,
  Undo2,
} from 'lucide-react';
import iconUrl from '../../assets/icon.png';
import { UNIT_NAMES } from '../../../language/units';
import {
  dispatchSourceCommand,
  insertSource,
  revealSource,
  type SourceCommand,
  type SourceLabel,
} from '../../sourceCommands';

interface DocumentHeaderProps {
  label: SourceLabel | null;
  onOpenSettings: () => void;
}

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({ label, onOpenSettings }) => {
  const title = label?.title || 'Regne';
  const computing = !label || label.computing;
  const broken = label?.broken ?? 0;

  return (
    <header className="relative z-20 flex items-center h-10 px-3 gap-5 border-b border-[var(--border-color)] bg-[var(--bg-chrome)] shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <img src={iconUrl} alt="" className="w-[18px] h-[18px] shrink-0 select-none" />
        <span className="text-[13px] truncate" title={title}>
          {title}
        </span>
        {label?.dirty && (
          <span
            role="img"
            aria-label="Unsaved changes"
            className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] shrink-0"
          />
        )}
      </div>

      <nav className="flex items-center gap-3 min-w-0" aria-label="Document">
        <div className="flex items-center">
          <HeaderButton tone="brass" label="New" onClick={() => dispatchSourceCommand('new')}>
            <FilePlus />
          </HeaderButton>
          <HeaderButton tone="brass" label="Open" onClick={() => dispatchSourceCommand('open')}>
            <FolderOpen />
          </HeaderButton>
          <HeaderButton tone="brass" label="Save" mark={label?.dirty} onClick={() => dispatchSourceCommand('save')}>
            <Save />
          </HeaderButton>
        </div>
        <div className="flex items-center">
          <HeaderButton tone="clay" label="Undo" onClick={() => dispatchSourceCommand('undo')}>
            <Undo2 />
          </HeaderButton>
          <HeaderButton tone="clay" label="Redo" onClick={() => dispatchSourceCommand('redo')}>
            <Redo2 />
          </HeaderButton>
        </div>
        <div className="flex items-center">
          <HeaderButton tone="steel" label="Export LaTeX" onClick={() => dispatchSourceCommand('export')}>
            <FileText />
          </HeaderButton>
          <HeaderButton tone="steel" label="Export HTML" onClick={() => dispatchSourceCommand('export-html')}>
            <FileCode />
          </HeaderButton>
        </div>
        <SectionsMenu headings={label?.headings ?? []} />
        <UnitsMenu />
      </nav>

      <div className="ml-auto flex items-center gap-1 shrink-0">
        <PowerStatus computing={computing} broken={broken} />
        <HeaderButton tone="clay" label="Settings" onClick={onOpenSettings}>
          <Settings />
        </HeaderButton>
      </div>
    </header>
  );
};

function HeaderButton({
  label,
  onClick,
  mark,
  pressed,
  tone = 'clay',
  children,
}: {
  label: string;
  onClick: () => void;
  mark?: boolean;
  pressed?: boolean;
  tone?: 'brass' | 'clay' | 'steel';
  children: React.ReactNode;
}) {
  const toneClass = {
    brass: 'text-[var(--icon-brass)]',
    clay: 'text-[var(--icon-clay)]',
    steel: 'text-[var(--icon-steel)]',
  }[tone];
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-7 h-7 [&_svg]:w-4 [&_svg]:h-4 [&_svg]:stroke-[1.5] ${
        mark || pressed ? 'text-[var(--text-primary)]' : `${toneClass} hover:text-[var(--text-primary)]`
      }`}
    >
      {children}
    </button>
  );
}

const COMMON_UNITS = [
  'm',
  'g',
  's',
  'L',
  'mol',
  'K',
  'N',
  'Pa',
  'bar',
  'J',
  'W',
  'Hz',
  'rad',
  'degC',
  'degF',
  'h',
  'min',
  'day',
];

function listedUnits(query: string): readonly string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return COMMON_UNITS;
  const prefix: string[] = [];
  const rest: string[] = [];
  for (const name of UNIT_NAMES) {
    const lower = name.toLowerCase();
    if (lower.startsWith(needle)) prefix.push(name);
    else if (lower.includes(needle)) rest.push(name);
    if (prefix.length >= 40) break;
  }
  return prefix.length >= 40 ? prefix : prefix.concat(rest).slice(0, 40);
}

function UnitsMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const names = listedUnits(query);
  const choose = (name: string) => {
    insertSource(name);
    close();
  };

  return (
    <div className="relative" ref={rootRef}>
      <HeaderButton tone="steel" label="Units" pressed={open} onClick={() => (open ? close() : setOpen(true))}>
        <Scale />
      </HeaderButton>
      {open && (
        <div
          role="menu"
          aria-label="Units"
          className="absolute top-full left-0 mt-1 w-56 border border-[var(--border-color)] bg-[var(--bg-surface)] z-20"
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && names[0]) {
                event.preventDefault();
                choose(names[0]);
              }
            }}
            placeholder="Find a unit"
            aria-label="Find a unit"
            className="shrink-0 h-8 px-3 border-b border-[var(--border-color)] bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
          <div className="max-h-64 overflow-auto py-1">
            {names.length === 0 ? (
              <p className="px-3 py-1.5 text-[13px] text-[var(--text-muted)]">No units</p>
            ) : (
              names.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="menuitem"
                  title={name}
                  className="block w-full text-left text-[13px] px-3 py-1.5 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] truncate"
                  onClick={() => choose(name)}
                >
                  {name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionsMenu({ headings }: { headings: SourceLabel['headings'] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <HeaderButton tone="clay" label="Sections" pressed={open} onClick={() => setOpen((value) => !value)}>
        <ListTree />
      </HeaderButton>
      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-1 min-w-52 max-w-72 max-h-64 overflow-auto border border-[var(--border-color)] bg-[var(--bg-surface)] py-1 z-20"
        >
          {headings.length === 0 ? (
            <p className="px-3 py-1.5 text-[13px] text-[var(--text-muted)]">No sections</p>
          ) : (
            headings.map((heading) => (
              <button
                key={`${heading.start}:${heading.title}`}
                type="button"
                role="menuitem"
                className="block w-full text-left text-[13px] py-1.5 pr-3 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] truncate"
                style={{ paddingLeft: `${0.75 + (heading.level - 1) * 0.75}rem` }}
                onClick={() => {
                  revealSource(heading.start);
                  setOpen(false);
                }}
              >
                {heading.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PowerStatus({ computing, broken }: { computing: boolean; broken: number }) {
  const text = computing ? 'Computing' : broken === 1 ? '1 line' : broken > 1 ? `${broken} lines` : 'Ready';
  const brokenPage = !computing && broken > 0;
  const className = `inline-flex items-center gap-1.5 h-7 px-1.5 text-[12px] [&_svg]:w-3.5 [&_svg]:h-3.5 [&_svg]:stroke-[1.5] ${
    brokenPage ? 'text-[var(--icon-clay)]' : 'text-[var(--icon-steel)]'
  }`;

  const body = (
    <>
      <Power />
      <span className="whitespace-nowrap">{text}</span>
    </>
  );

  if (brokenPage) {
    return (
      <button
        type="button"
        title="Next broken line"
        aria-label={`Next broken line, ${text}`}
        onClick={() => dispatchSourceCommand('next-broken' satisfies SourceCommand)}
        className={`${className} hover:text-[var(--text-primary)]`}
      >
        {body}
      </button>
    );
  }

  return (
    <span className={className} title={computing ? 'Computing' : 'Engine ready'} aria-live="polite">
      {body}
    </span>
  );
}
