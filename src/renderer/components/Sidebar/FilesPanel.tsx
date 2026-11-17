import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from 'lucide-react';
import type { DirEntry } from '../../../types/files';
import { ancestorDirectories, baseName, isDocumentFile, samePath } from './paths';

interface FilesPanelProps {
  folder: string | null;
  currentPath: string | null;
  onOpenFolder: () => void;
  onOpenFile: (filePath: string) => void;
}

function api() {
  return window.regneAPI || window.hypatiaAPI;
}

export const FilesPanel: React.FC<FilesPanelProps> = ({ folder, currentPath, onOpenFolder, onOpenFile }) => {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-9 px-3 flex items-center gap-2 border-b border-[var(--border-color)] shrink-0">
        <span className="truncate text-[13px]" title={folder ?? undefined}>
          {folder ? baseName(folder) : 'Explorer'}
        </span>
        <button
          type="button"
          title="Open Folder"
          aria-label="Open Folder"
          onClick={onOpenFolder}
          className="ml-auto inline-flex items-center justify-center w-7 h-7 text-[var(--icon-brass)] hover:text-[var(--text-primary)]"
        >
          <FolderOpen className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto select-none py-1">
        <RecentFiles currentPath={currentPath} onOpenFile={onOpenFile} />
        {folder ? (
          <FileTree root={folder} currentPath={currentPath} onOpenFile={onOpenFile} />
        ) : (
          <p className="px-3 py-2 text-[13px] text-[var(--text-muted)]">Open a folder to browse files.</p>
        )}
      </div>
    </div>
  );
};

function RecentFiles({
  currentPath,
  onOpenFile,
}: {
  currentPath: string | null;
  onOpenFile: (filePath: string) => void;
}) {
  const [paths, setPaths] = useState<string[]>([]);

  const load = useCallback(async () => {
    const client = api();
    if (!client?.recentDocuments) return;
    const result = await client.recentDocuments();
    if (!result.success || !result.paths) return;
    setPaths(result.paths.filter(isDocumentFile).slice(0, 8));
  }, []);

  useEffect(() => {
    void load();
  }, [load, currentPath]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  if (paths.length === 0) return null;

  return (
    <div className="pb-1">
      <p className="px-3 pt-1 pb-1 text-[12px] text-[var(--text-muted)]">Recent</p>
      {paths.map((filePath) => {
        const current = samePath(filePath, currentPath);
        return (
          <button
            key={filePath}
            type="button"
            title={filePath}
            onClick={() => onOpenFile(filePath)}
            className={`flex items-center gap-1.5 w-full min-w-0 h-6 px-3 text-left text-[13px] hover:bg-[var(--bg-subtle)] ${
              current ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            <File className="w-3.5 h-3.5 shrink-0 text-[var(--icon-steel)]" strokeWidth={1.5} />
            <span className="truncate">{baseName(filePath)}</span>
          </button>
        );
      })}
    </div>
  );
}

function FileTree({
  root,
  currentPath,
  onOpenFile,
}: {
  root: string;
  currentPath: string | null;
  onOpenFile: (filePath: string) => void;
}) {
  const [entries, setEntries] = useState<Record<string, DirEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const expandedRef = useRef(expanded);
  const rootRef = useRef(root);
  expandedRef.current = expanded;
  rootRef.current = root;

  const load = useCallback(async (dir: string) => {
    const client = api();
    if (!client?.listDirectory) {
      setError('Folder browsing is available in the app.');
      setLoaded(true);
      return;
    }
    const requestedRoot = root;
    const result = await client.listDirectory(root, dir);
    if (rootRef.current !== requestedRoot) return;
    if (!result.success || !result.entries) {
      if (dir === root) setError(result.error || 'Could not read this folder.');
      setLoaded(true);
      return;
    }
    if (dir === root) setError(null);
    setEntries((prev) => ({ ...prev, [dir]: result.entries ?? [] }));
    setLoaded(true);
  }, [root]);

  const loadRef = useRef(load);
  loadRef.current = load;

  const reloadOpen = useCallback(() => {
    void loadRef.current(rootRef.current);
    for (const dir of expandedRef.current) void loadRef.current(dir);
  }, []);

  useEffect(() => {
    const closed = new Set<string>();
    expandedRef.current = closed;
    setEntries({});
    setExpanded(closed);
    setLoaded(false);
    setError(null);
    void load(root);
  }, [root, load]);

  useEffect(() => {
    if (!currentPath) return;
    const dirs = ancestorDirectories(root, currentPath);
    if (dirs.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const dir of dirs) next.add(dir);
      expandedRef.current = next;
      return next;
    });
    for (const dir of dirs) void load(dir);
  }, [root, currentPath, load]);

  const seenPath = useRef(currentPath);
  useEffect(() => {
    if (seenPath.current === currentPath) return;
    seenPath.current = currentPath;
    reloadOpen();
  }, [currentPath, reloadOpen]);

  useEffect(() => {
    const onFocus = () => reloadOpen();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reloadOpen]);

  const toggle = (dir: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else {
        next.add(dir);
        if (!entries[dir]) void load(dir);
      }
      return next;
    });
  };

  const rootEntries = entries[root];

  return (
    <div>
      {error && <p className="px-3 py-2 text-[13px] text-[var(--text-muted)]">{error}</p>}
      {loaded && !error && rootEntries && rootEntries.length === 0 && (
        <p className="px-3 py-2 text-[13px] text-[var(--text-muted)]">This folder is empty.</p>
      )}
      {rootEntries && (
        <TreeRows
          dir={root}
          depth={0}
          entries={entries}
          expanded={expanded}
          currentPath={currentPath}
          onToggle={toggle}
          onOpenFile={onOpenFile}
        />
      )}
    </div>
  );
}

function TreeRows({
  dir,
  depth,
  entries,
  expanded,
  currentPath,
  onToggle,
  onOpenFile,
}: {
  dir: string;
  depth: number;
  entries: Record<string, DirEntry[]>;
  expanded: Set<string>;
  currentPath: string | null;
  onToggle: (dir: string) => void;
  onOpenFile: (filePath: string) => void;
}) {
  const list = entries[dir] ?? [];
  return (
    <>
      {list.map((entry) => {
        const open = entry.isDirectory && expanded.has(entry.path);
        const current = !entry.isDirectory && samePath(entry.path, currentPath);
        const canOpen = !entry.isDirectory && isDocumentFile(entry.name);
        const color = current
          ? 'text-[var(--text-primary)]'
          : canOpen || entry.isDirectory
            ? 'text-[var(--text-secondary)]'
            : 'text-[var(--text-muted)]';
        return (
          <React.Fragment key={entry.path}>
            <button
              type="button"
              title={entry.name}
              aria-disabled={!entry.isDirectory && !canOpen}
              onClick={() => {
                if (entry.isDirectory) onToggle(entry.path);
                else if (canOpen) onOpenFile(entry.path);
              }}
              className={`flex items-center gap-1 w-full min-w-0 h-6 pr-2 text-left text-[13px] ${
                current ? 'bg-[var(--bg-subtle)]' : ''
              } ${entry.isDirectory || canOpen ? 'hover:bg-[var(--bg-subtle)]' : ''} ${color}`}
              style={{ paddingLeft: `${8 + depth * 12}px` }}
            >
              {entry.isDirectory ? (
                open ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                )
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              {entry.isDirectory ? (
                <Folder className="w-3.5 h-3.5 shrink-0 text-[var(--icon-brass)]" strokeWidth={1.5} />
              ) : (
                <File
                  className={`w-3.5 h-3.5 shrink-0 ${canOpen ? 'text-[var(--icon-steel)]' : 'text-[var(--text-muted)]'}`}
                  strokeWidth={1.5}
                />
              )}
              <span className="truncate">{entry.name}</span>
            </button>
            {open && (
              <TreeRows
                dir={entry.path}
                depth={depth + 1}
                entries={entries}
                expanded={expanded}
                currentPath={currentPath}
                onToggle={onToggle}
                onOpenFile={onOpenFile}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}
