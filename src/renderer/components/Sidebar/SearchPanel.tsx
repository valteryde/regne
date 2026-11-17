import React, { useEffect, useRef, useState } from 'react';
import type { SearchHit } from '../../../types/files';
import { relativePath } from './paths';

interface SearchPanelProps {
  folder: string | null;
  active: boolean;
  focusToken: number;
  onOpenFile: (filePath: string, offset: number) => void;
}

function api() {
  return window.regneAPI || window.hypatiaAPI;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ folder, active, focusToken, onOpenFile }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState<'idle' | 'searching' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || focusToken === 0) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [active, focusToken]);

  useEffect(() => {
    const needle = query.trim();
    if (!folder || !needle) {
      setHits([]);
      setTruncated(false);
      setError(null);
      setStatus('idle');
      return;
    }
    const client = api();
    if (!client?.searchFolder) {
      setStatus('error');
      setError('Search is available in the app.');
      setHits([]);
      return;
    }
    let cancelled = false;
    setStatus('searching');
    const timer = window.setTimeout(() => {
      void client.searchFolder(folder, needle).then((result) => {
        if (cancelled) return;
        if (!result.success || !result.hits) {
          setStatus('error');
          setError(result.error || 'Search failed.');
          setHits([]);
          setTruncated(false);
          return;
        }
        setHits(result.hits);
        setTruncated(Boolean(result.truncated));
        setError(null);
        setStatus('done');
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [folder, query]);

  const groups = groupHits(hits);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 border-b border-[var(--border-color)] shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search"
          aria-label="Search"
          disabled={!folder}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full h-7 px-2 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none disabled:opacity-60"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto py-1">
        {!folder && (
          <p className="px-3 py-2 text-[13px] text-[var(--text-muted)]">Open a folder to search.</p>
        )}
        {folder && status === 'searching' && hits.length === 0 && (
          <p className="px-3 py-2 text-[13px] text-[var(--text-muted)]">Searching…</p>
        )}
        {folder && status === 'error' && error && (
          <p className="px-3 py-2 text-[13px] text-[var(--text-muted)]">{error}</p>
        )}
        {folder && status === 'done' && hits.length === 0 && (
          <p className="px-3 py-2 text-[13px] text-[var(--text-muted)]">No results</p>
        )}
        {groups.map((group) => (
          <div key={group.filePath} className="pb-1">
            <button
              type="button"
              title={group.filePath}
              onClick={() => onOpenFile(group.filePath, group.hits[0].offset)}
              className="block w-full min-w-0 px-3 pt-1.5 pb-0.5 text-left text-[12px] text-[var(--text-muted)] truncate hover:text-[var(--text-primary)]"
            >
              {folder ? relativePath(folder, group.filePath) : group.filePath}
            </button>
            {group.hits.map((hit) => (
              <button
                key={`${hit.filePath}:${hit.offset}`}
                type="button"
                onClick={() => onOpenFile(hit.filePath, hit.offset)}
                className="flex items-baseline gap-2 w-full min-w-0 px-3 py-0.5 text-left hover:bg-[var(--bg-subtle)]"
              >
                <span className="w-8 shrink-0 text-[12px] text-[var(--text-muted)] tabular-nums">{hit.line}</span>
                <span className="truncate text-[13px] text-[var(--text-secondary)]">
                  {hit.preview.slice(0, hit.matchStart)}
                  <span className="text-[var(--text-primary)]">
                    {hit.preview.slice(hit.matchStart, hit.matchStart + hit.matchLength)}
                  </span>
                  {hit.preview.slice(hit.matchStart + hit.matchLength)}
                </span>
              </button>
            ))}
          </div>
        ))}
        {truncated && (
          <p className="px-3 py-2 text-[12px] text-[var(--text-muted)]">Showing the first matches.</p>
        )}
      </div>
    </div>
  );
};

function groupHits(hits: SearchHit[]): { filePath: string; hits: SearchHit[] }[] {
  const groups: { filePath: string; hits: SearchHit[] }[] = [];
  for (const hit of hits) {
    const last = groups[groups.length - 1];
    if (last && last.filePath === hit.filePath) last.hits.push(hit);
    else groups.push({ filePath: hit.filePath, hits: [hit] });
  }
  return groups;
}
