import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  Info,
  RotateCcw,
  Command,
  Ruler,
  Check,
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { UpdaterState, VenvSetupState } from '../../../preload';
import { useEngine } from '../../context/EngineContext';
import { useDocument } from '../../context/DocumentContext';
import { RegneMascot } from '../Brand/RegneMascot';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'engine' | 'ruler' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('engine');
  const {
    activeEngine,
    switchEngine,
    availableEngines,
    reset,
  } = useEngine();
  const {
    isRulerVisible,
    setRulerVisible,
    rulerPosition,
    setRulerPosition,
    pageMargins,
    setPageMargins,
  } = useDocument();

  const [appVersion, setAppVersion] = useState<string>('1.1.2');
  const [updaterState, setUpdaterState] = useState<UpdaterState>({
    status: 'idle',
    info: null,
    progress: null,
    error: null,
  });
  const [venvState, setVenvState] = useState<VenvSetupState>({
    isSettingUp: false,
    message: '',
    error: null,
    venvPath: '',
    ready: false,
  });
  const [isRepairing, setIsRepairing] = useState<boolean>(false);

  useEffect(() => {
    const api = window.regneAPI || window.hypatiaAPI;
    if (api?.casSympy?.getSetupStatus) {
      api.casSympy.getSetupStatus().then((state) => {
        if (state) setVenvState(state);
      }).catch(() => {});
    }
    if (api?.casSympy?.onSetupProgress) {
      const unsub = api.casSympy.onSetupProgress((state) => {
        setVenvState(state);
      });
      return () => unsub();
    }
  }, []);

  useEffect(() => {
    const api = window.regneAPI || window.hypatiaAPI;
    if (api?.getVersion) {
      api.getVersion().then((v) => v && setAppVersion(v)).catch(() => {});
    }
    if (!api?.updater) return;

    api.updater.getState().then((state) => {
      if (state) setUpdaterState(state);
    }).catch(() => {});

    const unsubStatus = api.updater.onStatusChange((s) => setUpdaterState(s));
    const unsubProg = api.updater.onDownloadProgress((p) => {
      setUpdaterState((prev) => ({ ...prev, status: 'downloading', progress: p }));
    });

    return () => {
      unsubStatus?.();
      unsubProg?.();
    };
  }, []);

  const handleCheckForUpdates = () => {
    const api = window.regneAPI || window.hypatiaAPI;
    api?.updater.checkForUpdates().catch((err) => {
      console.error('[SettingsModal] Check for updates error:', err);
    });
  };

  const handleDownloadUpdate = () => {
    const api = window.regneAPI || window.hypatiaAPI;
    api?.updater.downloadUpdate().catch((err) => {
      console.error('[SettingsModal] Download update error:', err);
    });
  };

  const handleInstallUpdate = () => {
    const api = window.regneAPI || window.hypatiaAPI;
    api?.updater.installUpdate().catch((err) => {
      console.error('[SettingsModal] Install update error:', err);
    });
  };

  const handleRepairVenv = async () => {
    const api = window.regneAPI || window.hypatiaAPI;
    if (!api?.casSympy?.reinstallVenv) return;
    setIsRepairing(true);
    try {
      await api.casSympy.reinstallVenv();
    } catch (err) {
      console.error('[SettingsModal] Reinstall venv error:', err);
    } finally {
      setIsRepairing(false);
    }
  };

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-lg shadow-xl max-w-2xl w-full border border-[var(--border-color)] overflow-hidden flex flex-col max-h-[85vh] transition-colors">
        {/* Modal Header */}
        <div className="h-12 px-4 bg-[var(--bg-chrome)] border-b border-[var(--border-color)] flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-2.5">
            <RegneMascot size={20} />
            <div>
              <h2 className="text-xs font-semibold text-[var(--text-primary)]">
                Preferences
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Layout: Sidebar Tabs + Content Area */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Navigation Sidebar */}
          <aside className="w-44 bg-[var(--bg-chrome)]/40 border-r border-[var(--border-color)] p-2 space-y-0.5 select-none shrink-0">
            <button
              onClick={() => setActiveTab('engine')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium transition-colors text-left ${
                activeTab === 'engine'
                  ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/50 hover:text-[var(--text-primary)]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-[#242e84]" />
              <span>CAS Engine</span>
            </button>

            <button
              onClick={() => setActiveTab('ruler')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium transition-colors text-left ${
                activeTab === 'ruler'
                  ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/50 hover:text-[var(--text-primary)]'
              }`}
            >
              <Ruler className="w-3.5 h-3.5 text-[#242e84]" />
              <span>Ruler & Margins</span>
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium transition-colors text-left ${
                activeTab === 'about'
                  ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/50 hover:text-[var(--text-primary)]'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-[#242e84]" />
              <span>Shortcuts & Info</span>
            </button>
          </aside>

          {/* Tab Content Panel */}
          <div className="flex-1 overflow-y-auto p-5 bg-[var(--bg-surface)]">

            {/* 2. CAS ENGINE TAB */}
            {activeTab === 'engine' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                    Computational Solvers
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Select the active Computer Algebra System for symbolic evaluations.
                  </p>
                </div>

                {/* Available Engine Cards */}
                <div className="space-y-2">
                  {availableEngines.map((eng) => {
                    const isActive = eng.id === activeEngine.id;
                    return (
                      <div
                        key={eng.id}
                        onClick={() => switchEngine(eng.id)}
                        className={`p-3 rounded border cursor-pointer transition-all ${
                          isActive
                            ? 'border-[#242e84] ring-1 ring-[#242e84]/40 bg-[var(--bg-subtle)]/30'
                            : 'border-[var(--border-color)] hover:border-zinc-400 bg-[var(--bg-surface)]'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-[var(--text-primary)]">
                                {eng.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-[var(--bg-subtle)] rounded text-[var(--text-secondary)] font-mono">
                                v{eng.version}
                              </span>
                              {isActive && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                              {eng.description}
                            </p>
                          </div>

                          <div
                            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 ml-3 ${
                              isActive
                                ? 'bg-[#242e84] border-[#242e84] text-white'
                                : 'border-[var(--border-color)]'
                            }`}
                          >
                            {isActive && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>

                        {/* Capabilities Badges */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {eng.capabilities.symbolicMath && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                              Symbolic Math
                            </span>
                          )}
                          {eng.capabilities.calculus && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                              Calculus
                            </span>
                          )}
                          {eng.capabilities.linearAlgebra && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                              Matrices
                            </span>
                          )}
                          {eng.capabilities.customFunctions && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                              Variables (:=)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Session Reset Action */}
                <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                      Reset CAS Scope
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Clears session memory and assigned variables (restart;)
                    </div>
                  </div>
                  <button
                    onClick={reset}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--bg-subtle)] hover:bg-[var(--border-color)] text-[var(--text-primary)] text-xs font-medium border border-[var(--border-color)] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Scope</span>
                  </button>
                </div>

                {/* Dedicated Python Environment (venv) */}
                <div className="pt-3 border-t border-[var(--border-color)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                        <span>Dedicated Math Environment (venv)</span>
                        {venvState.ready && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        )}
                        {venvState.isSettingUp && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            Installing...
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono break-all select-all">
                        {venvState.venvPath || '~/Library/Application Support/Regne/venv'}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                        Private virtual environment containing SymPy &amp; Kaxe. Isolated from system Python.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRepairVenv}
                      disabled={isRepairing || venvState.isSettingUp}
                      className="shrink-0 ml-3 flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--bg-subtle)] hover:bg-[var(--border-color)] text-[var(--text-primary)] text-xs font-medium border border-[var(--border-color)] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${(isRepairing || venvState.isSettingUp) ? 'animate-spin' : ''}`} />
                      <span>{isRepairing ? 'Repairing...' : 'Repair / Reinstall'}</span>
                    </button>
                  </div>

                  {venvState.error && (
                    <div className="mt-2.5 p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{venvState.error}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RULER & MARGINS TAB */}
            {activeTab === 'ruler' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                    Document Ruler & Page Margins
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Configure the measurement ruler bar and page margins.
                  </p>
                </div>

                {/* Ruler Visibility Toggle */}
                <div className="p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-surface)] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">
                      Show Ruler Bar
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      Display the interactive inch measurement bar with margin sliders
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRulerVisible}
                      onChange={(e) => setRulerVisible(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#242e84]"></div>
                  </label>
                </div>

                {/* Ruler Placement (Top vs Bottom) */}
                <div className="p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-surface)] space-y-3">
                  <div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">
                      Ruler Placement
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      Choose whether the ruler docks at the top or bottom of the document workspace
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRulerPosition('top')}
                      className={`p-3 rounded border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        rulerPosition === 'top'
                          ? 'border-[#242e84] ring-1 ring-[#242e84]/40 bg-[var(--bg-subtle)]/40 font-semibold'
                          : 'border-[var(--border-color)] hover:border-zinc-400 bg-[var(--bg-surface)]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-xs text-[var(--text-primary)]">Top of Document</span>
                        {rulerPosition === 'top' && <Check className="w-3.5 h-3.5 text-[#242e84]" />}
                      </div>
                      <span className="text-[11px] text-[var(--text-secondary)] font-normal">
                        Canonical word-processor location above the document page
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRulerPosition('bottom')}
                      className={`p-3 rounded border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        rulerPosition === 'bottom'
                          ? 'border-[#242e84] ring-1 ring-[#242e84]/40 bg-[var(--bg-subtle)]/40 font-semibold'
                          : 'border-[var(--border-color)] hover:border-zinc-400 bg-[var(--bg-surface)]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-xs text-[var(--text-primary)]">Bottom of Document</span>
                        {rulerPosition === 'bottom' && <Check className="w-3.5 h-3.5 text-[#242e84]" />}
                      </div>
                      <span className="text-[11px] text-[var(--text-secondary)] font-normal">
                        Docked as a footer ruler at the bottom of the workspace
                      </span>
                    </button>
                  </div>
                </div>

                {/* Page Margins Inputs */}
                <div className="p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-surface)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-[var(--text-primary)]">
                        Page Margins (Inches)
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        Standard US Letter paper width is 8.5 inches
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPageMargins({ left: 1.0, right: 1.0 })}
                      className="text-[11px] text-[#242e84] hover:underline cursor-pointer font-medium"
                    >
                      Reset to 1.0"
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                        Left Margin:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.125"
                          min="0.25"
                          max="3.5"
                          value={pageMargins.left}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              setPageMargins((prev) => ({ ...prev, left: Math.max(0.25, Math.min(3.5, val)) }));
                            }
                          }}
                          className="w-24 px-2 py-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none focus:border-[#242e84]"
                        />
                        <span className="text-xs text-[var(--text-muted)]">in</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                        Right Margin:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.125"
                          min="0.25"
                          max="3.5"
                          value={pageMargins.right}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              setPageMargins((prev) => ({ ...prev, right: Math.max(0.25, Math.min(3.5, val)) }));
                            }
                          }}
                          className="w-24 px-2 py-1 text-xs border border-[var(--border-color)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none focus:border-[#242e84]"
                        />
                        <span className="text-xs text-[var(--text-muted)]">in</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. ABOUT & SHORTCUTS TAB */}
            {activeTab === 'about' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded bg-[var(--bg-subtle)]/40 border border-[var(--border-color)]">
                  <RegneMascot size={36} />
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                      Regne — Mathematical Document Workspace
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Continuous WYSIWYG document workspace for symbolic mathematics and technical reports.
                    </p>
                    <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                      Version {appVersion} (Python SymPy CAS • KaTeX • Electron)
                    </div>
                  </div>
                </div>

                {/* Software Updates Section */}
                <div className="p-3 rounded bg-[var(--bg-subtle)]/40 border border-[var(--border-color)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <RefreshCw className={`w-3.5 h-3.5 ${updaterState.status === 'checking' ? 'animate-spin text-[#242e84]' : 'text-[var(--text-secondary)]'}`} />
                      <h4 className="text-xs font-semibold text-[var(--text-primary)]">Software Updates</h4>
                    </div>
                    {updaterState.status !== 'downloading' && updaterState.status !== 'checking' && (
                      <button
                        onClick={handleCheckForUpdates}
                        className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-primary)] rounded text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Check for Updates</span>
                      </button>
                    )}
                  </div>

                  {updaterState.status === 'checking' && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] py-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#242e84]" />
                      <span>Checking GitHub for updates...</span>
                    </div>
                  )}

                  {updaterState.status === 'not-available' && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 py-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>You're running the latest version of Regne (v{appVersion}).</span>
                    </div>
                  )}

                  {updaterState.status === 'available' && (
                    <div className="flex items-center justify-between gap-2 py-1">
                      <span className="text-xs text-[var(--text-primary)]">
                        New version <span className="font-semibold">v{updaterState.info?.version}</span> is available.
                      </span>
                      <button
                        onClick={handleDownloadUpdate}
                        className="px-3 py-1 bg-[#242e84] hover:bg-[#1a2266] text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  )}

                  {updaterState.status === 'downloading' && (
                    <div className="space-y-1.5 py-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">
                          Downloading update ({Math.round(updaterState.progress?.percent ?? 0)}%)
                        </span>
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">
                          {((updaterState.progress?.transferred ?? 0) / (1024 * 1024)).toFixed(1)} / {((updaterState.progress?.total ?? 0) / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[var(--bg-chrome)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#242e84] rounded-full transition-all duration-200"
                          style={{ width: `${Math.min(updaterState.progress?.percent ?? 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {updaterState.status === 'downloaded' && (
                    <div className="flex items-center justify-between gap-2 py-1">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Update v{updaterState.info?.version} is ready to install.</span>
                      </div>
                      <button
                        onClick={handleInstallUpdate}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors cursor-pointer"
                      >
                        Restart & Install
                      </button>
                    </div>
                  )}

                  {updaterState.status === 'error' && (
                    <div className="flex items-center gap-2 text-xs text-rose-500 py-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{updaterState.error || 'Failed to check for updates'}</span>
                    </div>
                  )}

                  {updaterState.status === 'idle' && (
                    <div className="text-[11px] text-[var(--text-muted)] py-0.5">
                      Current release: v{appVersion}. Click "Check for Updates" to verify latest releases.
                    </div>
                  )}
                </div>

                {/* Keyboard Shortcuts Reference */}
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">
                    <Command className="w-3.5 h-3.5 text-[#242e84]" />
                    <span>Keyboard Shortcuts</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="p-2 rounded bg-[var(--bg-subtle)]/30 border border-[var(--border-color)] flex items-center justify-between">
                      <span className="text-[var(--text-secondary)] text-[11px]">Toggle Text / Math</span>
                      <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded font-mono text-[10px] font-medium">
                        F5
                      </kbd>
                    </div>

                    <div className="p-2 rounded bg-[var(--bg-subtle)]/30 border border-[var(--border-color)] flex items-center justify-between">
                      <span className="text-[var(--text-secondary)] text-[11px]">Evaluate Math Line</span>
                      <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded font-mono text-[10px] font-medium">
                        Enter
                      </kbd>
                    </div>

                    <div className="p-2 rounded bg-[var(--bg-subtle)]/30 border border-[var(--border-color)] flex items-center justify-between">
                      <span className="text-[var(--text-secondary)] text-[11px]">New Document</span>
                      <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded font-mono text-[10px] font-medium">
                        Ctrl/Cmd + N
                      </kbd>
                    </div>

                    <div className="p-2 rounded bg-[var(--bg-subtle)]/30 border border-[var(--border-color)] flex items-center justify-between">
                      <span className="text-[var(--text-secondary)] text-[11px]">Save Document</span>
                      <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded font-mono text-[10px] font-medium">
                        Ctrl/Cmd + S
                      </kbd>
                    </div>

                    <div className="p-2 rounded bg-[var(--bg-subtle)]/30 border border-[var(--border-color)] flex items-center justify-between">
                      <span className="text-[var(--text-secondary)] text-[11px]">Open Document</span>
                      <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded font-mono text-[10px] font-medium">
                        Ctrl/Cmd + O
                      </kbd>
                    </div>

                    <div className="p-2 rounded bg-[var(--bg-subtle)]/30 border border-[var(--border-color)] flex items-center justify-between">
                      <span className="text-[var(--text-secondary)] text-[11px]">Navigate Lines</span>
                      <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded font-mono text-[10px] font-medium">
                        ↑ / ↓
                      </kbd>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-11 px-4 bg-[var(--bg-chrome)] border-t border-[var(--border-color)] flex items-center justify-between text-xs select-none shrink-0">
          <div className="text-[11px] text-[var(--text-muted)]">
            Active: <span className="font-medium text-[var(--text-primary)]">{activeEngine.name}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#242e84] hover:bg-[#1a2266] text-white rounded text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
