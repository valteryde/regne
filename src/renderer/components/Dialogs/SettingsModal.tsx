import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Cpu,
  Download,
  FileText,
  Info,
  Power,
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { UpdaterState, VenvSetupState } from '../../../preload';
import { useDocument } from '../../context/DocumentContext';
import { useEngine } from '../../context/EngineContext';
import iconUrl from '../../assets/icon.png';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'page' | 'engine' | 'about';

const EMPTY_UPDATER: UpdaterState = {
  status: 'idle',
  info: null,
  progress: null,
  error: null,
};

const EMPTY_VENV: VenvSetupState = {
  isSettingUp: false,
  message: '',
  error: null,
  venvPath: '',
  ready: false,
};

function client() {
  return window.regneAPI || window.hypatiaAPI;
}

function commandLabel(platform: string | undefined): string {
  if (platform) return platform === 'darwin' ? 'Cmd' : 'Ctrl';
  return /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl';
}

function clampMargin(value: number): number {
  return Math.max(0.25, Math.min(3.5, value));
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<Tab>('page');
  const [command, setCommand] = useState(() => commandLabel(undefined));
  const { activeEngine, status } = useEngine();
  const { zoom, setZoom, pageMargins, setPageMargins } = useDocument();
  const [appVersion, setAppVersion] = useState('');
  const [updater, setUpdater] = useState<UpdaterState>(EMPTY_UPDATER);
  const [venv, setVenv] = useState<VenvSetupState>(EMPTY_VENV);
  const [repairing, setRepairing] = useState(false);

  useEffect(() => {
    const api = client();
    if (api?.getPlatform) setCommand(commandLabel(api.getPlatform()));
    if (api?.getVersion) {
      api.getVersion().then((version) => version && setAppVersion(version)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const api = client();
    if (!api?.casSympy?.getSetupStatus) return;
    api.casSympy.getSetupStatus().then((state) => {
      if (state) setVenv(state);
    }).catch(() => {});
    if (!api.casSympy.onSetupProgress) return;
    return api.casSympy.onSetupProgress((state) => setVenv(state));
  }, []);

  useEffect(() => {
    const api = client();
    if (!api?.updater) return;
    api.updater.getState().then((state) => {
      if (state) setUpdater(state);
    }).catch(() => {});
    const unsubStatus = api.updater.onStatusChange((state) => setUpdater(state));
    const unsubProgress = api.updater.onDownloadProgress((progress) => {
      setUpdater((prev) => ({ ...prev, status: 'downloading', progress }));
    });
    return () => {
      unsubStatus?.();
      unsubProgress?.();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const checkForUpdates = () => {
    client()?.updater.checkForUpdates().catch((err) => {
      console.error('[Settings] Check for updates error:', err);
    });
  };

  const downloadUpdate = () => {
    client()?.updater.downloadUpdate().catch((err) => {
      console.error('[Settings] Download update error:', err);
    });
  };

  const installUpdate = () => {
    client()?.updater.installUpdate().catch((err) => {
      console.error('[Settings] Install update error:', err);
    });
  };

  const repairEnvironment = async () => {
    const api = client();
    if (!api?.casSympy?.reinstallVenv) return;
    setRepairing(true);
    try {
      await api.casSympy.reinstallVenv();
    } catch (err) {
      console.error('[Settings] Reinstall environment error:', err);
    } finally {
      setRepairing(false);
    }
  };

  if (!isOpen) return null;

  const busy = repairing || venv.isSettingUp;
  const canRepair = Boolean(client()?.casSympy?.reinstallVenv);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex flex-col w-full max-w-xl max-h-[85vh] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
      >
        <header className="flex items-center h-10 px-3 gap-2 border-b border-[var(--border-color)] bg-[var(--bg-chrome)] shrink-0">
          <img src={iconUrl} alt="" className="w-[18px] h-[18px] select-none" />
          <h2 id="settings-title" className="text-[13px]">
            Settings
          </h2>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto inline-flex items-center justify-center w-7 h-7 text-[var(--icon-clay)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </header>

        <div className="flex min-h-0 overflow-hidden">
          <nav
            aria-label="Settings"
            className="w-36 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-chrome)] py-2"
          >
            <NavButton active={tab === 'page'} tone="brass" label="Page" onClick={() => setTab('page')}>
              <FileText />
            </NavButton>
            <NavButton active={tab === 'engine'} tone="steel" label="Engine" onClick={() => setTab('engine')}>
              <Cpu />
            </NavButton>
            <NavButton active={tab === 'about'} tone="clay" label="About" onClick={() => setTab('about')}>
              <Info />
            </NavButton>
          </nav>

          <div className="flex-1 min-w-0 overflow-auto p-4">
            {tab === 'page' && (
              <PageSettings
                zoom={zoom}
                setZoom={setZoom}
                left={pageMargins.left}
                right={pageMargins.right}
                setPageMargins={setPageMargins}
              />
            )}
            {tab === 'engine' && (
              <EngineSettings
                version={activeEngine.version}
                status={status}
                venv={venv}
                busy={busy}
                repairing={repairing}
                canRepair={canRepair}
                onRepair={() => void repairEnvironment()}
              />
            )}
            {tab === 'about' && (
              <AboutSettings
                version={appVersion}
                command={command}
                updater={updater}
                onCheck={checkForUpdates}
                onDownload={downloadUpdate}
                onInstall={installUpdate}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function PageSettings({
  zoom,
  setZoom,
  left,
  right,
  setPageMargins,
}: {
  zoom: number;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  left: number;
  right: number;
  setPageMargins: (margins: { left: number; right: number }) => void;
}) {
  const setMargin = (side: 'left' | 'right', raw: string) => {
    const value = parseFloat(raw);
    if (Number.isNaN(value)) return;
    setPageMargins({
      left: side === 'left' ? clampMargin(value) : left,
      right: side === 'right' ? clampMargin(value) : right,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-[var(--text-secondary)]">
        The sheet is US Letter, 8.5 inches wide. Margins inset the text.
      </p>

      <section className="border border-[var(--border-color)]">
        <div className="flex items-center justify-between gap-3 px-3 h-10 border-b border-[var(--border-color)]">
          <span className="text-[13px]">Zoom</span>
          <div className="flex items-center">
            <IconButton
              label="Zoom out"
              disabled={zoom <= 0.5}
              onClick={() => setZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(1))))}
            >
              <ZoomOut />
            </IconButton>
            <span className="w-12 text-center text-[13px] tabular-nums">{Math.round(zoom * 100)}%</span>
            <IconButton
              label="Zoom in"
              disabled={zoom >= 2}
              onClick={() => setZoom((prev) => Math.min(2, Number((prev + 0.1).toFixed(1))))}
            >
              <ZoomIn />
            </IconButton>
            <TextButton className="ml-2" onClick={() => setZoom(1)}>
              Actual size
            </TextButton>
          </div>
        </div>
        <MarginField label="Left margin" value={left} onChange={(raw) => setMargin('left', raw)} />
        <MarginField label="Right margin" value={right} onChange={(raw) => setMargin('right', raw)} />
        <div className="flex justify-end items-center px-3 h-9">
          <TextButton onClick={() => setPageMargins({ left: 1, right: 1 })}>Reset margins</TextButton>
        </div>
      </section>
    </div>
  );
}

function EngineSettings({
  version,
  status,
  venv,
  busy,
  repairing,
  canRepair,
  onRepair,
}: {
  version: string;
  status: string;
  venv: VenvSetupState;
  busy: boolean;
  repairing: boolean;
  canRepair: boolean;
  onRepair: () => void;
}) {
  const failed = Boolean(venv.error) || status === 'error';
  const text = venv.error
    ? venv.error
    : status === 'error'
      ? 'The engine is not ready'
      : venv.isSettingUp
        ? venv.message || 'Installing the environment'
        : status === 'busy'
          ? 'Computing'
          : venv.ready || status === 'ready'
            ? 'Ready'
            : 'Starting';
  const spinning = venv.isSettingUp || status === 'busy';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-[13px]">SymPy {version}</h3>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          SymPy and Pint run the file from the top. A restart line clears the names below it.
        </p>
      </div>

      <section className="border border-[var(--border-color)]">
        <div className="flex items-start justify-between gap-3 px-3 py-2 border-b border-[var(--border-color)]">
          <div className="min-w-0">
            <div className="text-[13px]">Python environment</div>
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              Private environment for SymPy, Pint, and Kaxe.
            </p>
            <p className="mt-1 font-mono text-[12px] text-[var(--text-muted)] break-all select-all">
              {venv.venvPath || '~/Library/Application Support/Regne/venv'}
            </p>
          </div>
          <TextButton title="Reinstall the Python environment" disabled={!canRepair || busy} onClick={onRepair}>
            <RefreshCw className={busy ? 'animate-spin' : ''} />
            {repairing ? 'Repairing' : 'Repair'}
          </TextButton>
        </div>
        <div
          className={`flex items-center gap-1.5 px-3 min-h-9 py-2 text-[13px] ${
            failed ? 'text-[var(--icon-clay)]' : 'text-[var(--icon-steel)]'
          }`}
        >
          {failed ? (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          ) : spinning ? (
            <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" strokeWidth={1.5} />
          ) : (
            <Power className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          )}
          <span>{text}</span>
        </div>
      </section>
    </div>
  );
}

function AboutSettings({
  version,
  command,
  updater,
  onCheck,
  onDownload,
  onInstall,
}: {
  version: string;
  command: string;
  updater: UpdaterState;
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
}) {
  const checking = updater.status === 'checking' || updater.status === 'downloading';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <img src={iconUrl} alt="" className="w-8 h-8 select-none" />
        <div>
          <h3 className="text-[13px]">Regne</h3>
          <p className="text-[13px] text-[var(--text-secondary)]">A source file and the page it typesets.</p>
          {version ? <p className="text-[12px] text-[var(--text-muted)]">Version {version}</p> : null}
        </div>
      </div>

      <section className="border border-[var(--border-color)]">
        <div className="flex items-center justify-between gap-3 px-3 h-10 border-b border-[var(--border-color)]">
          <span className="text-[13px]">Updates</span>
          {!checking && updater.status !== 'available' && updater.status !== 'downloaded' && (
            <TextButton onClick={onCheck}>
              <RefreshCw />
              Check
            </TextButton>
          )}
        </div>
        <UpdateBody updater={updater} version={version} onDownload={onDownload} onInstall={onInstall} />
      </section>

      <div>
        <h3 className="text-[13px] mb-2">Shortcuts</h3>
        <ShortcutList command={command} />
      </div>
    </div>
  );
}

function UpdateBody({
  updater,
  version,
  onDownload,
  onInstall,
}: {
  updater: UpdaterState;
  version: string;
  onDownload: () => void;
  onInstall: () => void;
}) {
  if (updater.status === 'checking') {
    return (
      <p className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-[var(--icon-steel)]">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
        Checking for updates
      </p>
    );
  }

  if (updater.status === 'not-available') {
    return (
      <p className="px-3 py-2 text-[13px] text-[var(--text-secondary)]">
        Version {version || 'this release'} is current.
      </p>
    );
  }

  if (updater.status === 'available') {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <p className="text-[13px] text-[var(--text-secondary)]">
          Version {updater.info?.version} is available.
        </p>
        <TextButton onClick={onDownload}>
          <Download />
          Download
        </TextButton>
      </div>
    );
  }

  if (updater.status === 'downloading') {
    const percent = Math.min(updater.progress?.percent ?? 0, 100);
    const transferred = ((updater.progress?.transferred ?? 0) / (1024 * 1024)).toFixed(1);
    const total = ((updater.progress?.total ?? 0) / (1024 * 1024)).toFixed(1);
    return (
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-[13px] text-[var(--text-secondary)]">
          <span>Downloading {Math.round(percent)}%</span>
          <span className="font-mono text-[12px] text-[var(--text-muted)]">
            {transferred} / {total} MB
          </span>
        </div>
        <div className="mt-2 h-1 bg-[var(--bg-subtle)]">
          <div className="h-full bg-[var(--icon-steel)]" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }

  if (updater.status === 'downloaded') {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <p className="text-[13px] text-[var(--text-secondary)]">
          Version {updater.info?.version} is ready to install.
        </p>
        <TextButton onClick={onInstall}>Restart and install</TextButton>
      </div>
    );
  }

  if (updater.status === 'error') {
    return (
      <p className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-[var(--icon-clay)]">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
        <span className="min-w-0 truncate">{updater.error || 'Could not check for updates'}</span>
      </p>
    );
  }

  return (
    <p className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
      {version ? `Current release ${version}.` : 'Check for a newer release.'}
    </p>
  );
}

function ShortcutList({ command }: { command: string }) {
  const groups: { title: string; rows: [string, string][] }[] = [
    {
      title: 'File',
      rows: [
        ['New', `${command}+N`],
        ['Open', `${command}+O`],
        ['Save', `${command}+S`],
        ['Save as', `${command}+Shift+S`],
      ],
    },
    {
      title: 'Edit',
      rows: [
        ['Undo', `${command}+Z`],
        ['Redo', `${command}+Shift+Z`],
        ['Find', `${command}+F`],
        ['Parent term', 'Alt+↑'],
        ['Child term', 'Alt+↓'],
      ],
    },
    {
      title: 'View',
      rows: [
        ['Explorer', `${command}+Shift+E`],
        ['Search', `${command}+Shift+F`],
        ['Sidebar', `${command}+B`],
        ['Zoom in', `${command}+=`],
        ['Zoom out', `${command}+-`],
        ['Actual size', `${command}+0`],
        ['Settings', `${command}+,`],
      ],
    },
  ];

  return (
    <div className="border border-[var(--border-color)]">
      {groups.map((group, index) => (
        <div key={group.title} className={index > 0 ? 'border-t border-[var(--border-color)]' : ''}>
          <div className="px-3 pt-2 pb-1 text-[12px] text-[var(--text-muted)]">
            {group.title}
          </div>
          {group.rows.map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between gap-4 px-3 h-8">
              <span className="text-[13px]">{label}</span>
              <span className="font-mono text-[12px] text-[var(--text-muted)]">{keys}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MarginField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (raw: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 px-3 h-10 border-b border-[var(--border-color)]">
      <span className="text-[13px]">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          step="0.125"
          min="0.25"
          max="3.5"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-20 h-7 px-2 text-[13px] bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-primary)] outline-none focus:border-[var(--icon-steel)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-[13px] text-[var(--text-muted)]">in</span>
      </span>
    </label>
  );
}

function NavButton({
  active,
  tone,
  label,
  onClick,
  children,
}: {
  active: boolean;
  tone: 'brass' | 'clay' | 'steel';
  label: string;
  onClick: () => void;
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`w-full flex items-center gap-2 h-8 px-3 text-[13px] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:stroke-[1.5] ${
        active ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]' : `${toneClass} hover:text-[var(--text-primary)]`
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center w-7 h-7 text-[var(--icon-steel)] hover:text-[var(--text-primary)] disabled:opacity-40 [&_svg]:w-4 [&_svg]:h-4 [&_svg]:stroke-[1.5]"
    >
      {children}
    </button>
  );
}

function TextButton({
  children,
  onClick,
  disabled,
  title,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-7 text-[13px] text-[var(--icon-steel)] hover:text-[var(--text-primary)] disabled:opacity-40 [&_svg]:w-3.5 [&_svg]:h-3.5 [&_svg]:stroke-[1.5] ${className}`}
    >
      {children}
    </button>
  );
}
