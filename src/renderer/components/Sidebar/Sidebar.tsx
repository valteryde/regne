import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Files, Search } from 'lucide-react';
import { dispatchSourceFileOpen, revealSource, useSourceLabel } from '../../sourceCommands';
import { FilesPanel } from './FilesPanel';
import { parentDirectory, samePath } from './paths';
import { SearchPanel } from './SearchPanel';

type SidebarView = 'files' | 'search';

const FOLDER_KEY = 'regne:folder';
const OPEN_KEY = 'regne:sidebar-open';
const VIEW_KEY = 'regne:sidebar-view';

function readFolder(): string | null {
  try {
    return localStorage.getItem(FOLDER_KEY) || null;
  } catch {
    return null;
  }
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

function readView(): SidebarView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'search' ? 'search' : 'files';
  } catch {
    return 'files';
  }
}

function client() {
  return window.regneAPI || window.hypatiaAPI;
}

export const Sidebar: React.FC = () => {
  const label = useSourceLabel();
  const [folder, setFolderState] = useState<string | null>(readFolder);
  const [panelOpen, setPanelOpen] = useState(readOpen);
  const [view, setView] = useState<SidebarView>(readView);
  const [focusSearch, setFocusSearch] = useState(0);
  const checkedFolder = useRef(false);

  const setFolder = useCallback((next: string | null | ((current: string | null) => string | null)) => {
    setFolderState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      try {
        if (resolved) localStorage.setItem(FOLDER_KEY, resolved);
        else localStorage.removeItem(FOLDER_KEY);
      } catch {
        // Storage can be blocked. The folder still applies for this window.
      }
      return resolved;
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, panelOpen ? '1' : '0');
    } catch {
      // The choice still applies for this window.
    }
  }, [panelOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // The choice still applies for this window.
    }
  }, [view]);

  useEffect(() => {
    if (checkedFolder.current) return;
    checkedFolder.current = true;
    if (!folder) return;
    const api = client();
    if (!api?.listDirectory) return;
    const stored = folder;
    void api.listDirectory(stored, stored).then((result) => {
      if (!result.success) setFolder((current) => (current === stored ? null : current));
    });
  }, [folder, setFolder]);

  useEffect(() => {
    if (folder || !label?.path) return;
    const parent = parentDirectory(label.path);
    if (parent) setFolder(parent);
  }, [folder, label?.path, setFolder]);

  const chooseFolder = useCallback(async () => {
    const api = client();
    if (!api?.openFolder) return;
    const result = await api.openFolder();
    if (!result.success || result.canceled || !result.folderPath) return;
    setFolder(result.folderPath);
    setView('files');
    setPanelOpen(true);
  }, [setFolder]);

  const showFiles = useCallback(() => {
    setView('files');
    setPanelOpen(true);
  }, []);

  const showSearch = useCallback(() => {
    setView('search');
    setPanelOpen(true);
    setFocusSearch((value) => value + 1);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpen((open) => !open);
  }, []);

  const actions = useRef({ chooseFolder, showFiles, showSearch, togglePanel });
  actions.current = { chooseFolder, showFiles, showSearch, togglePanel };

  useEffect(() => {
    const api = client();
    if (!api?.onMenuCommand) return;
    return api.onMenuCommand((command) => {
      if (command === 'open-folder') void actions.current.chooseFolder();
      else if (command === 'show-explorer') actions.current.showFiles();
      else if (command === 'show-search') actions.current.showSearch();
      else if (command === 'toggle-sidebar') actions.current.togglePanel();
    });
  }, []);

  useEffect(() => {
    if (client()?.onMenuCommand) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'b' && !event.shiftKey) {
        event.preventDefault();
        actions.current.togglePanel();
      } else if (key === 'e' && event.shiftKey) {
        event.preventDefault();
        actions.current.showFiles();
      } else if (key === 'f' && event.shiftKey) {
        event.preventDefault();
        actions.current.showSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectView = (next: SidebarView) => {
    if (view === next && panelOpen) {
      setPanelOpen(false);
      return;
    }
    setView(next);
    setPanelOpen(true);
    if (next === 'search') setFocusSearch((value) => value + 1);
  };

  const openFile = async (filePath: string, revealOffset?: number) => {
    if (samePath(label?.path, filePath)) {
      if (revealOffset != null) revealSource(revealOffset);
      return;
    }
    const api = client();
    if (!api?.readFile) return;
    const result = await api.readFile(filePath);
    if (!result.success || result.content == null) return;
    dispatchSourceFileOpen(result.content, filePath, revealOffset);
  };

  const filesActive = view === 'files' && panelOpen;
  const searchActive = view === 'search' && panelOpen;

  return (
    <div className="flex h-full min-h-0 shrink-0">
      <nav
        aria-label="Sidebar"
        className="w-12 h-full flex flex-col items-center gap-1 py-2 border-r border-[var(--border-color)] bg-[var(--bg-chrome)]"
      >
        <ActivityButton tone="brass" label="Explorer" pressed={filesActive} onClick={() => selectView('files')}>
          <Files />
        </ActivityButton>
        <ActivityButton tone="clay" label="Search" pressed={searchActive} onClick={() => selectView('search')}>
          <Search />
        </ActivityButton>
      </nav>
      {panelOpen && (
        <div className="w-[260px] h-full min-h-0 min-w-0 border-r border-[var(--border-color)] bg-[var(--bg-chrome)]">
          <div className={view === 'files' ? 'flex flex-col h-full min-h-0' : 'hidden'}>
            <FilesPanel
              folder={folder}
              currentPath={label?.path ?? null}
              onOpenFolder={() => void chooseFolder()}
              onOpenFile={(filePath) => void openFile(filePath)}
            />
          </div>
          <div className={view === 'search' ? 'flex flex-col h-full min-h-0' : 'hidden'}>
            <SearchPanel
              folder={folder}
              active={searchActive}
              focusToken={focusSearch}
              onOpenFile={(filePath, offset) => void openFile(filePath, offset)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

function ActivityButton({
  label,
  pressed,
  onClick,
  tone,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  tone: 'brass' | 'clay';
  children: React.ReactNode;
}) {
  const toneClass = tone === 'brass' ? 'text-[var(--icon-brass)]' : 'text-[var(--icon-clay)]';
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-10 h-10 [&_svg]:w-5 [&_svg]:h-5 [&_svg]:stroke-[1.5] ${toneClass} ${
        pressed ? '' : 'hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}
